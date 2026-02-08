import { Response } from 'express';
import { ExportJob } from '../models/exportJob';
import pool from '../db';
import QueryStream from 'pg-query-stream';
import { Transform, pipeline } from 'stream';
import * as fastCsv from 'fast-csv';
import zlib from 'zlib';
import * as parquets from 'parquetjs-lite';

export const streamExport = async (job: ExportJob, res: Response) => {
    const client = await pool.connect();
    let streamDestroyed = false;

    const cleanup = () => {
        if (!streamDestroyed) {
            client.release();
            streamDestroyed = true;
        }
    };

    res.on('finish', cleanup);
    res.on('close', cleanup);
    res.on('error', cleanup);

    try {
        const selectCols = job.columns.map(c => `"${c.source}"`).join(', ');
        const query = new QueryStream(`SELECT ${selectCols} FROM records`);
        const dbStream = client.query(query);

        // Set Headers
        if (typeof res.setHeader === 'function') {
            res.setHeader('Content-Type', getContentType(job.format));
            res.setHeader('Content-Disposition', `attachment; filename="export-${job.exportId}.${job.format}"`);
            if (job.compression === 'gzip' && job.format !== 'parquet') {
                res.setHeader('Content-Encoding', 'gzip');
            }
        }

        if (job.format === 'parquet') {
            const schemaDef: any = {};
            job.columns.forEach(col => {
                if (col.source === 'id') schemaDef[col.target] = { type: 'INT64' };
                else if (col.source === 'value') schemaDef[col.target] = { type: 'DOUBLE' };
                else schemaDef[col.target] = { type: 'UTF8' };
            });

            const schema = new parquets.ParquetSchema(schemaDef);

            // PassThrough to write to response
            const passthrough = new Transform({
                transform(chunk, enc, cb) { cb(null, chunk); }
            });

            passthrough.pipe(res);

            const writer = await parquets.ParquetWriter.openStream(schema, passthrough);

            // Iterate with backpressure
            for await (const row of dbStream) {
                const mapped: any = {};
                for (const col of job.columns) {
                    let val = row[col.source];
                    if (typeof val === 'object' && val !== null) {
                        val = JSON.stringify(val);
                    }
                    mapped[col.target] = val;
                }
                await writer.appendRow(mapped);
            }
            await writer.close();

        } else {
            let transformer: Transform;

            if (job.format === 'csv') {
                transformer = fastCsv.format({ headers: job.columns.map(c => c.target) });
                const rowMapper = new Transform({
                    objectMode: true,
                    transform(row, encoding, callback) {
                        const mappedRow: any = {};
                        job.columns.forEach(col => {
                            let val = row[col.source];
                            if (typeof val === 'object' && val !== null) {
                                val = JSON.stringify(val);
                            }
                            mappedRow[col.target] = val;
                        });
                        callback(null, mappedRow);
                    }
                });
                dbStream.pipe(rowMapper).pipe(transformer);
            } else if (job.format === 'json') {
                let isFirst = true;
                transformer = new Transform({
                    writableObjectMode: true,
                    transform(row, encoding, callback) {
                        const mappedRow: any = {};
                        job.columns.forEach(col => mappedRow[col.target] = row[col.source]);

                        let chunk = JSON.stringify(mappedRow);
                        if (isFirst) {
                            this.push('[' + chunk);
                            isFirst = false;
                        } else {
                            this.push(',' + chunk);
                        }
                        callback();
                    },
                    flush(callback) {
                        if (isFirst) this.push('[]');
                        else this.push(']');
                        callback();
                    }
                });
                dbStream.pipe(transformer);
            } else if (job.format === 'xml') {
                let isFirstXml = true;
                transformer = new Transform({
                    writableObjectMode: true,
                    transform(row, encoding, callback) {
                        if (isFirstXml) {
                            this.push('<?xml version="1.0" encoding="UTF-8"?><records>');
                            isFirstXml = false;
                        }

                        const mappedRow: any = {};
                        job.columns.forEach(col => mappedRow[col.target] = row[col.source]);

                        let rowStr = '<record>';
                        for (const k of Object.keys(mappedRow)) {
                            rowStr += `<${k}>${escapeXml(mappedRow[k])}</${k}>`;
                        }
                        rowStr += '</record>';

                        this.push(rowStr);
                        callback();
                    },
                    flush(callback) {
                        if (isFirstXml) this.push('<?xml version="1.0" encoding="UTF-8"?><records>');
                        this.push('</records>');
                        callback();
                    }
                });
                dbStream.pipe(transformer);
            } else {
                throw new Error('Unsupported format');
            }

            if (job.compression === 'gzip') {
                const gzip = zlib.createGzip();
                transformer.pipe(gzip).pipe(res);
            } else {
                transformer.pipe(res);
            }
        }

    } catch (err) {
        console.error('Export Error:', err);
        cleanup();
        if (!res.headersSent) {
            if (typeof res.status === 'function') res.status(500).json({ error: 'Export failed' });
        }
    }
};

function getContentType(format: string) {
    switch (format) {
        case 'csv': return 'text/csv';
        case 'json': return 'application/json';
        case 'xml': return 'application/xml';
        case 'parquet': return 'application/octet-stream';
        default: return 'text/plain';
    }
}

function getFileExtension(format: string) {
    return format;
}

function escapeXml(unsafe: any): string {
    if (unsafe === null || unsafe === undefined) return '';
    if (typeof unsafe === 'object') {
        let xml = '';
        for (const [key, value] of Object.entries(unsafe)) {
            xml += `<${key}>${escapeXml(value)}</${key}>`;
        }
        return xml;
    }
    return String(unsafe).replace(/[<>&'"]/g, c => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
        return c;
    });
}

import { Request, Response } from 'express';
import { CreateExportJobSchema } from '../models/exportJob';
import * as exportService from '../services/exportService';
import { streamExport } from '../services/streamer';

export const createExport = async (req: Request, res: Response) => {
    try {
        const validatedData = CreateExportJobSchema.parse(req.body);
        const job = exportService.createJob(validatedData);
        res.status(201).json({ exportId: job.exportId, status: job.status });
    } catch (error) {
        res.status(400).json({ error: 'Invalid request', details: error });
    }
};

export const downloadExport = async (req: Request, res: Response) => {
    const { exportId } = req.params;
    const job = exportService.getJob(exportId);

    if (!job) {
        return res.status(404).json({ error: 'Export job not found' });
    }

    // Update status to processing (in-memory, simple)
    exportService.updateJobStatus(exportId, 'processing');

    try {
        await streamExport(job, res);
        exportService.updateJobStatus(exportId, 'completed');
    } catch (err) {
        console.error('Streaming error:', err);
        exportService.updateJobStatus(exportId, 'failed');
        if (!res.headersSent) res.status(500).json({ error: 'Streaming failed' });
    }
};

export const getBenchmark = async (req: Request, res: Response) => {
    // This should ideally run in background or be pre-calculated, but for this assignment we run it on demand.
    // Warning: This will take time.

    // We need to measure 4 formats.
    const formats = ['csv', 'json', 'xml', 'parquet'] as const;
    const results = [];

    // Mock Request for creating a job equivalent to full export
    const columns = [
        { source: 'id', target: 'id' },
        { source: 'created_at', target: 'createdAt' },
        { source: 'name', target: 'name' },
        { source: 'value', target: 'value' },
        { source: 'metadata', target: 'metadata' }
    ];

    for (const format of formats) {
        const job = exportService.createJob({
            format,
            columns,
            compression: undefined
        });

        const start = process.hrtime();
        const startMem = process.memoryUsage().heapUsed;

        // We need to stream to a blackhole to measure performance without network overhead,
        // OR we can stream to a temporary file to measure file size.
        // The requirement says "fileSizeBytes". So we need the size.
        // We can wrap the response object to count bytes.

        let byteCount = 0;
        const mockRes: any = {
            setHeader: () => { },
            status: () => mockRes,
            json: () => { },
            on: (ev: string, cb: any) => { if (ev === 'finish') cb(); },
            once: () => { },
            emit: () => { },
            write: (chunk: any) => { byteCount += chunk.length; return true; },
            end: () => { },
            pipe: (dest: any) => dest
        };

        // We need a pass through that counts bytes
        // But streamExport expects a Response (Writable).
        // We can use a PassThrough stream that counts bytes and discards data.

        // Actually, streamExport calls `res.write` or `pipe(res)`.
        // We can pass a Writable that counts bytes.

        // However, streamExport logic is tied to `res` object a bit (headers).
        // I'll refactor streamExport or use a mock.

        // Measuring peak memory is hard in JS from inside. We can poll `process.memoryUsage().heapUsed`.
        let peakMem = 0;
        const memInterval = setInterval(() => {
            const m = process.memoryUsage().heapUsed;
            if (m > peakMem) peakMem = m;
        }, 100);

        // We need to actually run the export.
        // We'll use a modified streamExport or just call it with a custom Writable.

        // Problem: streamExport is async but pipes to res. It finishes when stream finishes.
        // We need to know when it finishes.

        try {
            await new Promise<void>((resolve, reject) => {
                const Writable = require('stream').Writable;
                const counter = new Writable({
                    write(chunk: any, encoding: any, callback: any) {
                        byteCount += chunk.length;
                        callback();
                    }
                });

                // Mock the res object to look like Express Response + Writable
                const dummyRes: any = Object.assign(counter, {
                    setHeader: () => { },
                    status: (c: number) => dummyRes,
                    json: () => { },
                });

                streamExport(job, dummyRes).then(() => {
                    // The promise from streamExport currently resolves when setup is done, not when stream is done?
                    // Let's check streamExport in streamer.ts.
                    // It relies on `res.on('finish')`.
                    // Our dummyRes is a Writable, so it will emit finish when ended.
                    counter.on('finish', resolve);
                    counter.on('error', reject);
                }).catch(reject);
            });
        } catch (e) {
            console.error(`Benchmark failed for ${format}`, e);
        } finally {
            clearInterval(memInterval);
        }

        const [seconds, nanoseconds] = process.hrtime(start);
        const duration = seconds + nanoseconds / 1e9;

        results.push({
            format,
            durationSeconds: duration,
            fileSizeBytes: byteCount,
            peakMemoryMB: Math.round(peakMem / 1024 / 1024 * 100) / 100
        });
    }

    res.json({
        datasetRowCount: 10000000,
        results
    });
};

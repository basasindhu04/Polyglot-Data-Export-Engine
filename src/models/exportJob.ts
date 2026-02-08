import { z } from 'zod';

export const ExportFormat = z.enum(['csv', 'json', 'xml', 'parquet']);
export type ExportFormat = z.infer<typeof ExportFormat>;

export const ColumnMapping = z.object({
    source: z.string(),
    target: z.string(),
});
export type ColumnMapping = z.infer<typeof ColumnMapping>;

export const Compression = z.enum(['gzip']).optional();
export type Compression = z.infer<typeof Compression>;

export const CreateExportJobSchema = z.object({
    format: ExportFormat,
    columns: z.array(ColumnMapping).min(1),
    compression: Compression,
});
export type CreateExportJobRequest = z.infer<typeof CreateExportJobSchema>;

export interface ExportJob {
    exportId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    format: ExportFormat;
    columns: ColumnMapping[];
    compression?: 'gzip';
    createdAt: Date;
}

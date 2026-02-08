import { v4 as uuidv4 } from 'uuid';
import { ExportJob, CreateExportJobRequest } from '../models/exportJob';

// In-memory store for jobs. In production, use Redis or Postgres.
const jobStore = new Map<string, ExportJob>();

export const createJob = (req: CreateExportJobRequest): ExportJob => {
    const job: ExportJob = {
        exportId: uuidv4(),
        status: 'pending',
        format: req.format,
        columns: req.columns,
        compression: req.compression,
        createdAt: new Date(),
    };
    jobStore.set(job.exportId, job);
    return job;
};

export const getJob = (exportId: string): ExportJob | undefined => {
    return jobStore.get(exportId);
};

export const updateJobStatus = (exportId: string, status: ExportJob['status']) => {
    const job = jobStore.get(exportId);
    if (job) {
        job.status = status;
    }
};

import { Router } from 'express';
import { createExport, downloadExport, getBenchmark } from '../controllers/exportController';

export const exportRouter = Router();

exportRouter.post('/', createExport);
exportRouter.get('/benchmark', getBenchmark);
exportRouter.get('/:exportId/download', downloadExport);

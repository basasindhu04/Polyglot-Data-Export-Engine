import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { exportRouter } from './routes/exports';

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

app.use('/exports', exportRouter);

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

export default app;

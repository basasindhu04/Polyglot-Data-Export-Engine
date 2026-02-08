import app from './app';
import { config } from './config';
import pool from './db';

const start = async () => {
    try {
        // Check DB connection
        await pool.query('SELECT 1');
        console.log('Database connected successfully.');

        app.listen(config.port, () => {
            console.log(`Server running on port ${config.port}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
};

start();

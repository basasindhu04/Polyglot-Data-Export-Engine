import { Pool } from 'pg';
import { config } from '../config';

const pool = new Pool({
    connectionString: config.databaseUrl,
    max: 10, // reasonable pool size
    idleTimeoutMillis: 30000,
});

pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

export const query = (text: string, params?: any[]) => pool.query(text, params);
export const getClient = () => pool.connect();

export default pool;

import dotenv from 'dotenv';
dotenv.config();

export const config = {
    port: process.env.PORT || 8080,
    databaseUrl: process.env.DATABASE_URL || 'postgres://user:password@localhost:5432/exports_db',
};

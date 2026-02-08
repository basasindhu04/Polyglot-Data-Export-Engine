import request from 'supertest';
import app from '../src/app';

// Mock the DB connection to prevent startup errors
jest.mock('../src/db', () => ({
    query: jest.fn(),
    getClient: jest.fn(),
    __esModule: true,
    default: {
        query: jest.fn(),
        connect: jest.fn(),
        on: jest.fn(),
    }
}));

describe('Export API', () => {
    it('should respond to health check', async () => {
        const res = await request(app).get('/health');
        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual({ status: 'ok' });
    });

    // Further tests would require mocking 'pg' pool.
});

import request from 'supertest';
import { describe, it, expect } from 'vitest';

import app from '@/app';
import { adminToken } from '@/tests/globalSetup';
import { ImportEntityType, ImportStatus } from '../models/import.entity';

describe('Import API - Customer', () => {
  let importBatchId: number;

  const customerImportPayload = {
    originalFileName: 'customers_test.csv',
    data: [
      {
        email: 'import.customer1@example.com',
        firstName: 'Import',
        lastName: 'Customer1',
        defaultCurrencyId: 1,
        billingAddressId: 4,
      },
      {
        email: 'import.customer2@example.com',
        firstName: 'Import',
        lastName: 'Customer2',
        defaultCurrencyId: 1,
        billingAddressId: 5,
      },
    ],
  };

  describe('POST /import/customers', () => {
    it('should schedule a customer import successfully', async () => {
      const res = await request(app)
        .post('/api/v1/import/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(customerImportPayload);

      expect(res.status).toBe(202);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.entityType).toBe(ImportEntityType.CUSTOMER);
      expect(res.body.data.status).toBe(ImportStatus.PENDING);
      importBatchId = res.body.data.id; // Capture the batch ID
    });

    it('should return 400 if data payload is empty', async () => {
      const res = await request(app)
        .post('/api/v1/import/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ originalFileName: 'empty.csv', data: [] });

      expect(res.status).toBe(400);
    });

    it('should return 401 if not authenticated', async () => {
      const res = await request(app).post('/api/v1/import/customers').send(customerImportPayload);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /import/batches/{id}', () => {
    it('should return the status of the customer import batch', async () => {
      const res = await request(app)
        .get(`/api/v1/import/batches/${importBatchId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id', importBatchId);
      expect(res.body.data).toHaveProperty('entityType', ImportEntityType.CUSTOMER);
      expect(res.body.data).toHaveProperty('status');
      expect(res.body.data).toHaveProperty('summary');
    });

    it('should return 404 for a non-existent batch ID', async () => {
      const res = await request(app)
        .get('/api/v1/import/batches/999999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('should return 400 for an invalid batch ID format', async () => {
      const res = await request(app)
        .get('/api/v1/import/batches/abc')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('should return 401 if not authenticated', async () => {
      const res = await request(app).get(`/api/v1/import/batches/${importBatchId}`);

      expect(res.status).toBe(401);
    });
  });
});

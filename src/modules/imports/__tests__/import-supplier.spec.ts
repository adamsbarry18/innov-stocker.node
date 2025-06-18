import request from 'supertest';
import { describe, it, expect } from 'vitest';

import app from '@/app';
import { adminToken } from '@/tests/globalSetup';
import { ImportEntityType, ImportStatus } from '../models/import.entity';

describe('Import API - Supplier', () => {
  let importBatchId: number;

  const supplierImportPayload = {
    originalFileName: 'suppliers_test.csv',
    data: [
      {
        name: 'Import Supplier 1',
        email: 'import.supplier1@example.com',
        addressId: 2,
        defaultCurrencyId: 1,
      },
      {
        name: 'Import Supplier 2',
        email: 'import.supplier2@example.com',
        addressId: 3,
        defaultCurrencyId: 1,
      },
    ],
  };

  describe('POST /import/suppliers', () => {
    it('should schedule a supplier import successfully', async () => {
      const res = await request(app)
        .post('/api/v1/import/suppliers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(supplierImportPayload);

      expect(res.status).toBe(202);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.entityType).toBe(ImportEntityType.SUPPLIER);
      expect(res.body.data.status).toBe(ImportStatus.PENDING);
      importBatchId = res.body.data.id; // Capture the batch ID
    });
  });

  describe('GET /import/batches/{id}', () => {
    it('should return the status of the supplier import batch', async () => {
      const res = await request(app)
        .get(`/api/v1/import/batches/${importBatchId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id', importBatchId);
      expect(res.body.data).toHaveProperty('entityType', ImportEntityType.SUPPLIER);
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

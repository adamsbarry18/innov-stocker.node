import request from 'supertest';
import { describe, it, expect } from 'vitest';

import app from '@/app';
import { adminToken } from '@/tests/globalSetup';
import { ImportEntityType, ImportStatus } from '../models/import.entity';

describe('Import API - Product', () => {
  let importBatchId: number;

  const productImportPayload = {
    originalFileName: 'products_test.csv',
    data: [
      {
        sku: 'IMP-PROD-001',
        name: 'Imported Product 1',
        description: 'A product imported via test',
        productCategoryId: 1, // Électronique (from 2-datas.sql)
        unitOfMeasure: 'piece',
        defaultSellingPriceHt: 100.0,
      },
      {
        sku: 'IMP-PROD-002',
        name: 'Imported Product 2',
        description: 'Another product imported via test',
        productCategoryId: 2, // Informatique (from 2-datas.sql)
        unitOfMeasure: 'unit',
        defaultSellingPriceHt: 250.0,
      },
    ],
  };

  describe('POST /import/products', () => {
    it('should schedule a product import successfully', async () => {
      const res = await request(app)
        .post('/api/v1/import/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(productImportPayload);

      expect(res.status).toBe(202);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.entityType).toBe(ImportEntityType.PRODUCT);
      expect(res.body.data.status).toBe(ImportStatus.PENDING);
      importBatchId = res.body.data.id; // Capture the batch ID
    });

    it('should return 400 if data payload is empty', async () => {
      const res = await request(app)
        .post('/api/v1/import/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ originalFileName: 'empty.csv', data: [] });

      expect(res.status).toBe(400);
    });

    it('should return 401 if not authenticated', async () => {
      const res = await request(app).post('/api/v1/import/products').send(productImportPayload);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /import/batches/{id}', () => {
    it('should return the status of the product import batch', async () => {
      const res = await request(app)
        .get(`/api/v1/import/batches/${importBatchId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id', importBatchId);
      expect(res.body.data).toHaveProperty('entityType', ImportEntityType.PRODUCT);
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

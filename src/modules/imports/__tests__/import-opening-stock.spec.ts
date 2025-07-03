import request from 'supertest';
import { describe, it, expect } from 'vitest';

import app from '@/app';
import { adminToken } from '@/tests/globalSetup';
import { ImportEntityType, ImportStatus } from '../models/import.entity';

describe('Import API - Opening Stock', () => {
  let importBatchId: number;

  const openingStockImportPayload = {
    originalFileName: 'opening_stock_test.csv',
    data: [
      {
        productId: 1, // Smartphone Modèle X (from 2-datas.sql)
        locationId: 1, // Entrepôt Principal Paris Sud (from 2-datas.sql)
        locationType: 'warehouse',
        quantity: 10,
        unitCost: 300.0,
      },
      {
        productId: 3, // Chargeur USB-C Rapide (from 2-datas.sql)
        locationId: 1, // Boutique InnovStocker Nantes (from 2-datas.sql)
        locationType: 'shop',
        quantity: 50,
        unitCost: 8.0,
      },
    ],
  };

  describe('POST /import/opening-stock', () => {
    it('should schedule an opening stock import successfully', async () => {
      const res = await request(app)
        .post('/api/v1/import/opening-stock')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(openingStockImportPayload);

      expect(res.status).toBe(202);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.entityType).toBe(ImportEntityType.OPENING_STOCK);
      expect(res.body.data.status).toBe(ImportStatus.PENDING);
      importBatchId = res.body.data.id; // Capture the batch ID
    });

    it('should return 400 if data payload is empty', async () => {
      const res = await request(app)
        .post('/api/v1/import/opening-stock')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ originalFileName: 'empty.csv', data: [] });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /import/batches/{id}', () => {
    it('should return the status of the opening stock import batch', async () => {
      const res = await request(app)
        .get(`/api/v1/import/batches/${importBatchId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id', importBatchId);
      expect(res.body.data).toHaveProperty('entityType', ImportEntityType.OPENING_STOCK);
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
  });
});

import request from 'supertest';
import { describe, it, expect } from 'vitest';

import app from '@/app';
import { adminToken } from '@/tests/globalSetup';
import { ImportEntityType, ImportStatus } from '../models/import.entity';

describe('Import API - Purchase Order', () => {
  let importBatchId: number;
  const uniqueOrderNumber = `PO-IMP-${Date.now()}`;

  const purchaseOrderImportPayload = {
    originalFileName: 'purchase_orders_test.csv',
    data: [
      {
        orderNumber: uniqueOrderNumber,
        supplierId: 1, // Fournisseur HighTech Global (from 2-datas.sql)
        orderDate: '2025-06-17',
        status: 'approved',
        currencyId: 1, // EUR (from 2-datas.sql)
        warehouseIdForDelivery: 1, // Entrepôt Principal Paris Sud (from 2-datas.sql)
        items: [
          {
            productId: 2, // Ordinateur Portable Pro 15" (from 2-datas.sql)
            quantity: 3,
            unitPriceHt: 650.0,
          },
        ],
      },
    ],
  };

  describe('POST /import/purchase-orders', () => {
    it('should schedule a purchase order import successfully', async () => {
      const res = await request(app)
        .post('/api/v1/import/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(purchaseOrderImportPayload);

      expect(res.status).toBe(202);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.entityType).toBe(ImportEntityType.PURCHASE_ORDER);
      expect(res.body.data.status).toBe(ImportStatus.PENDING);
      importBatchId = res.body.data.id; // Capture the batch ID
    });

    it('should return 400 if data payload is empty', async () => {
      const res = await request(app)
        .post('/api/v1/import/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ originalFileName: 'empty.csv', data: [] });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /import/batches/{id}', () => {
    it('should return the status of the purchase order import batch', async () => {
      const res = await request(app)
        .get(`/api/v1/import/batches/${importBatchId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id', importBatchId);
      expect(res.body.data).toHaveProperty('entityType', ImportEntityType.PURCHASE_ORDER);
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

import request from 'supertest';
import { describe, it, expect } from 'vitest';

import app from '@/app';
import { adminToken } from '@/tests/globalSetup';
import { ImportEntityType, ImportStatus } from '../models/import.entity';

describe('Import API - Sales Order', () => {
  let importBatchId: number;
  const uniqueOrderNumber = `SO-IMP-${Date.now()}`;

  const salesOrderImportPayload = {
    originalFileName: 'sales_orders_test.csv',
    data: [
      {
        orderNumber: uniqueOrderNumber,
        customerId: 1, // Jean Dupont (from 2-datas.sql)
        orderDate: '2025-06-18',
        status: 'approved',
        currencyId: 1, // EUR (from 2-datas.sql)
        shippingAddressId: 5, // Client A - Livraison Principale (from 2-datas.sql)
        billingAddressId: 4, // Client A - Facturation (from 2-datas.sql)
        items: [
          {
            productId: 1, // Smartphone Modèle X (from 2-datas.sql)
            quantity: 2,
            unitPriceHt: 450.0,
          },
          {
            productId: 3, // Chargeur USB-C Rapide (from 2-datas.sql)
            quantity: 5,
            unitPriceHt: 20.0,
          },
        ],
      },
    ],
  };

  describe('POST /import/sales-orders', () => {
    it('should schedule a sales order import successfully', async () => {
      const res = await request(app)
        .post('/api/v1/import/sales-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(salesOrderImportPayload);

      expect(res.status).toBe(202);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.entityType).toBe(ImportEntityType.SALES_ORDER);
      expect(res.body.data.status).toBe(ImportStatus.PENDING);
      importBatchId = res.body.data.id; // Capture the batch ID
    });

    it('should return 400 if data payload is empty', async () => {
      const res = await request(app)
        .post('/api/v1/import/sales-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ originalFileName: 'empty.csv', data: [] });

      expect(res.status).toBe(400);
    });

    it('should return 401 if not authenticated', async () => {
      const res = await request(app)
        .post('/api/v1/import/sales-orders')
        .send(salesOrderImportPayload);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /import/batches/{id}', () => {
    it('should return the status of the sales order import batch', async () => {
      const res = await request(app)
        .get(`/api/v1/import/batches/${importBatchId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id', importBatchId);
      expect(res.body.data).toHaveProperty('entityType', ImportEntityType.SALES_ORDER);
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

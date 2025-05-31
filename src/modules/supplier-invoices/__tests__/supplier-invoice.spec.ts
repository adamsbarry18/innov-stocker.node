import { describe, it, expect } from 'vitest';
import request from 'supertest';

import app from '@/app';
import { adminToken } from '@/tests/globalSetup';

import dayjs from 'dayjs';

// IDs des données pré-existantes dans 2-datas.sql

const testSupplierInvoiceInputWithItems = {
  invoiceNumber: `TEST-INV-${Date.now()}`,
  supplierId: 3, // Nouveau Fournisseur Global Components Inc.
  invoiceDate: dayjs().format('YYYY-MM-DD'),
  dueDate: dayjs().add(30, 'day').format('YYYY-MM-DD'),
  currencyId: 3, // Nouvelle devise GBP
  notes: 'Test supplier invoice with new items and new supplier/currency',
  items: [
    {
      productId: 8, // Nouveau produit Câble HDMI 2.1
      description: 'Câble HDMI 2.1 (test)',
      quantity: 10,
      unitPriceHt: 5.0,
      vatRatePercentage: 20.0,
    },
    {
      productId: 7, // Webcam HD 1080p
      description: 'Webcam HD 1080p (test)',
      quantity: 3,
      unitPriceHt: 12.0,
      vatRatePercentage: 20.0,
    },
  ],
};

const testSupplierInvoiceInputNoItems = {
  invoiceNumber: `TEST-INV-NOITEMS-${Date.now()}`,
  supplierId: 3, // Nouveau Fournisseur Global Components Inc.
  invoiceDate: dayjs().format('YYYY-MM-DD'),
  dueDate: dayjs().add(30, 'day').format('YYYY-MM-DD'),
  currencyId: 3, // Nouvelle devise GBP
  notes: 'Test supplier invoice without items, new supplier/currency',
  items: [],
};

describe('SupplierInvoices API', () => {
  let createdInvoiceId: number;
  let createdInvoiceId2: number;

  describe('POST /supplier-invoices', () => {
    it('should create a new supplier-invoice with items', async () => {
      const res = await request(app)
        .post('/api/v1/supplier-invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testSupplierInvoiceInputWithItems);
      createdInvoiceId = res.body.data.id;
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.supplierId).toBe(testSupplierInvoiceInputWithItems.supplierId);
      expect(res.body.data.items).toHaveLength(2);
    });
    it('should create a new supplier-invoice without items', async () => {
      const res = await request(app)
        .post('/api/v1/supplier-invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testSupplierInvoiceInputNoItems);
      createdInvoiceId2 = res.body.data.id;
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.supplierId).toBe(testSupplierInvoiceInputNoItems.supplierId);
      expect(res.body.data.items).toHaveLength(0);
    });
    it('should fail to create a supplier-invoice with invalid supplierId', async () => {
      const invalidInput = { ...testSupplierInvoiceInputWithItems, supplierId: 999999 };
      const res = await request(app)
        .post('/api/v1/supplier-invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidInput);
      expect(res.status).toBe(400);
    });
    it('should fail to create a supplier-invoice with invalid productId', async () => {
      const invalidInput = {
        ...testSupplierInvoiceInputWithItems,
        items: [
          {
            productId: 999999,
            description: 'Invalid',
            quantity: 1,
            unitPriceHt: 1,
            vatRatePercentage: 20,
          },
        ],
      };
      const res = await request(app)
        .post('/api/v1/supplier-invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidInput);
      expect(res.status).toBe(400);
    });
    it('should fail to create a supplier-invoice with negative quantity', async () => {
      const invalidInput = {
        ...testSupplierInvoiceInputWithItems,
        items: [
          {
            productId: 1,
            description: 'Negative qty',
            quantity: -5,
            unitPriceHt: 1,
            vatRatePercentage: 20,
          },
        ],
      };
      const res = await request(app)
        .post('/api/v1/supplier-invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidInput);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /supplier-invoices', () => {
    it('should return a paginated list of supplier invoices', async () => {
      const res = await request(app)
        .get('/api/v1/supplier-invoices')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('invoices');
      expect(Array.isArray(res.body.data.invoices)).toBe(true);
      expect(res.body.data).toHaveProperty('total');
    });
  });

  describe('GET /supplier-invoices/:id', () => {
    it('should return a supplier invoice by id', async () => {
      const res = await request(app)
        .get(`/api/v1/supplier-invoices/${createdInvoiceId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id', createdInvoiceId);
    });
    it('should return 404 for non-existent supplier invoice', async () => {
      const res = await request(app)
        .get('/api/v1/supplier-invoices/999999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
    it('should return 400 for invalid id format', async () => {
      const res = await request(app)
        .get('/api/v1/supplier-invoices/abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /supplier-invoices/:id', () => {
    const updateData = {
      notes: 'Updated notes for supplier invoice',
    };
    it('should update a supplier invoice', async () => {
      const res = await request(app)
        .put(`/api/v1/supplier-invoices/${createdInvoiceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);
      expect(res.status).toBe(200);
      expect(res.body.data.notes).toBe(updateData.notes);
    });
    it('should return 404 for updating a non-existent supplier invoice', async () => {
      const res = await request(app)
        .put('/api/v1/supplier-invoices/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);
      expect(res.status).toBe(404);
    });
    it('should return 400 for invalid id format', async () => {
      const res = await request(app)
        .put('/api/v1/supplier-invoices/abc')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /supplier-invoices/:id/status', () => {
    it('should update the status of a supplier invoice', async () => {
      const res = await request(app)
        .patch(`/api/v1/supplier-invoices/${createdInvoiceId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'paid' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('paid');
    });
    it('should return 404 for non-existent supplier invoice', async () => {
      const res = await request(app)
        .patch('/api/v1/supplier-invoices/999999/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'paid' });
      expect(res.status).toBe(404);
    });
    it('should return 400 for invalid id format', async () => {
      const res = await request(app)
        .patch('/api/v1/supplier-invoices/abc/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'paid' });
      expect(res.status).toBe(400);
    });
    it('should return 400 for invalid status value', async () => {
      const res = await request(app)
        .patch(`/api/v1/supplier-invoices/${createdInvoiceId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'not_a_status' });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /supplier-invoices/:id', () => {
    let invoiceToDeleteId: number;

    beforeEach(async () => {
      // Create a new invoice specifically for deletion test
      const res = await request(app)
        .post('/api/v1/supplier-invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...testSupplierInvoiceInputNoItems,
          invoiceNumber: `DELETE-TEST-INV-${Date.now()}`,
        });
      invoiceToDeleteId = res.body.data.id;
    });

    it('should soft delete a supplier invoice', async () => {
      const res = await request(app)
        .delete(`/api/v1/supplier-invoices/${invoiceToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);
    });
    it('should return 404 for deleting a non-existent supplier invoice', async () => {
      const res = await request(app)
        .delete('/api/v1/supplier-invoices/999999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
    it('should return 400 for invalid id format', async () => {
      const res = await request(app)
        .delete('/api/v1/supplier-invoices/abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });
});

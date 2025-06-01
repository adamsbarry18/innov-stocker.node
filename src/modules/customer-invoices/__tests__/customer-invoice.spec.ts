import { describe, it, expect } from 'vitest';
import request from 'supertest';

import app from '@/app';
import { adminToken } from '@/tests/globalSetup';

import dayjs from 'dayjs';

// IDs des données pré-existantes dans 2-datas.sql
// Clients: 1 (Jean Dupont), 2 (Entreprise ABC SARL)
// Produits: 1 (Smartphone), 2 (Laptop), 3 (Chargeur)
// Adresses: 4, 5 (Jean Dupont), 6 (Entreprise ABC)
// Devis, commandes, factures déjà présentes

const testCustomerInvoiceInputWithItems = {
  invoiceNumber: `TEST-CUST-INV-${Date.now()}`,
  customerId: 1, // Jean Dupont
  invoiceDate: dayjs().format('YYYY-MM-DD'),
  dueDate: dayjs().add(15, 'day').format('YYYY-MM-DD'),
  currencyId: 1, // EUR
  billingAddressId: 4,
  shippingAddressId: 5,
  notes: 'Test customer invoice with items',
  termsAndConditions: 'Paiement sous 15 jours.',
  items: [
    {
      productId: 2, // Laptop
      description: 'Ordinateur Portable Pro 15" (test)',
      quantity: 1,
      unitPriceHt: 950.0,
      discountPercentage: 0,
      vatRatePercentage: 20.0,
    },
    {
      productId: 3, // Chargeur
      description: 'Chargeur USB-C Rapide (test)',
      quantity: 2,
      unitPriceHt: 20.0,
      discountPercentage: 0,
      vatRatePercentage: 20.0,
    },
  ],
  salesOrderIds: [1], // Lier à SO-2025-00001
};

const testCustomerInvoiceInputNoItems = {
  invoiceNumber: `TEST-CUST-INV-NOITEMS-${Date.now()}`,
  customerId: 2, // Entreprise ABC SARL
  invoiceDate: dayjs().format('YYYY-MM-DD'),
  dueDate: dayjs().add(30, 'day').format('YYYY-MM-DD'),
  currencyId: 1, // EUR
  billingAddressId: 6,
  shippingAddressId: 6,
  notes: 'Test customer invoice without items',
  termsAndConditions: 'Paiement sous 30 jours.',
  items: [],
  salesOrderIds: [2],
};

describe('CustomerInvoices API', () => {
  let createdInvoiceId: number;
  let createdInvoiceId2: number;

  describe('POST /customer-invoices', () => {
    it('should create a new customer-invoice with items', async () => {
      const res = await request(app)
        .post('/api/v1/customer-invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...testCustomerInvoiceInputWithItems });
      createdInvoiceId = res.body.data.id;
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.customerId).toBe(testCustomerInvoiceInputWithItems.customerId);
      expect(res.body.data.items).toHaveLength(2);
      expect(res.body.data.salesOrderLinks[0].salesOrderId).toBe(1);
    });
    it('should create a new customer-invoice without items', async () => {
      const res = await request(app)
        .post('/api/v1/customer-invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...testCustomerInvoiceInputNoItems });
      createdInvoiceId2 = res.body.data.id;
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.customerId).toBe(testCustomerInvoiceInputNoItems.customerId);
      expect(res.body.data.items).toHaveLength(0);
      expect(res.body.data.salesOrderLinks[0].salesOrderId).toBe(2);
    });
  });

  describe('GET /customer-invoices', () => {
    it('should return a paginated list of customer invoices', async () => {
      const res = await request(app)
        .get('/api/v1/customer-invoices')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('invoices');
      expect(Array.isArray(res.body.data.invoices)).toBe(true);
      expect(res.body.data).toHaveProperty('total');
    });
  });

  describe('GET /customer-invoices/:id', () => {
    it('should return a customer invoice by id', async () => {
      const res = await request(app)
        .get(`/api/v1/customer-invoices/${createdInvoiceId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id', createdInvoiceId);
    });
    it('should return 404 for non-existent customer invoice', async () => {
      const res = await request(app)
        .get('/api/v1/customer-invoices/999999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
    it('should return 400 for invalid id format', async () => {
      const res = await request(app)
        .get('/api/v1/customer-invoices/abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /customer-invoices/:id', () => {
    const updateData = {
      notes: 'Updated notes for customer invoice',
    };
    it('should update a customer invoice', async () => {
      const res = await request(app)
        .put(`/api/v1/customer-invoices/${createdInvoiceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);
      expect(res.status).toBe(200);
      expect(res.body.data.notes).toBe(updateData.notes);
    });
    it('should return 404 for updating a non-existent customer invoice', async () => {
      const res = await request(app)
        .put('/api/v1/customer-invoices/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);
      expect(res.status).toBe(404);
    });
    it('should return 400 for invalid id format', async () => {
      const res = await request(app)
        .put('/api/v1/customer-invoices/abc')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /customer-invoices/:id/status', () => {
    it('should update the status of a customer invoice', async () => {
      const res = await request(app)
        .patch(`/api/v1/customer-invoices/${createdInvoiceId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'paid' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('paid');
    });
    it('should return 404 for non-existent customer invoice', async () => {
      const res = await request(app)
        .patch('/api/v1/customer-invoices/999999/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'paid' });
      expect(res.status).toBe(404);
    });
    it('should return 400 for invalid id format', async () => {
      const res = await request(app)
        .patch('/api/v1/customer-invoices/abc/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'paid' });
      expect(res.status).toBe(400);
    });
    it('should return 400 for invalid status value', async () => {
      const res = await request(app)
        .patch(`/api/v1/customer-invoices/${createdInvoiceId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'not_a_status' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /customer-invoices/:id/send', () => {
    let invoiceToSendId: number;

    beforeEach(async () => {
      // Create a new invoice specifically for the send test
      const res = await request(app)
        .post('/api/v1/customer-invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...testCustomerInvoiceInputWithItems,
          invoiceNumber: `SEND-TEST-CUST-INV-${Date.now()}`,
        });
      invoiceToSendId = res.body.data.id;
    });

    it('should mark the invoice as sent', async () => {
      const res = await request(app)
        .post(`/api/v1/customer-invoices/${invoiceToSendId}/send`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('sent');
    });
    it('should return 404 for non-existent invoice', async () => {
      const res = await request(app)
        .post('/api/v1/customer-invoices/999999/send')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
    it('should return 400 for invalid id format', async () => {
      const res = await request(app)
        .post('/api/v1/customer-invoices/abc/send')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /customer-invoices/:id', () => {
    let invoiceToDeleteId: number;

    beforeEach(async () => {
      // Create a new invoice specifically for deletion test
      const res = await request(app)
        .post('/api/v1/customer-invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...testCustomerInvoiceInputNoItems,
          invoiceNumber: `DELETE-TEST-CUST-INV-${Date.now()}`,
        });
      invoiceToDeleteId = res.body.data.id;
    });

    it('should delete a customer invoice', async () => {
      const res = await request(app)
        .delete(`/api/v1/customer-invoices/${invoiceToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);
    });
    it('should return 404 for deleting a non-existent customer invoice', async () => {
      const res = await request(app)
        .delete('/api/v1/customer-invoices/999999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
    it('should return 400 for invalid id format', async () => {
      const res = await request(app)
        .delete('/api/v1/customer-invoices/abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });
});

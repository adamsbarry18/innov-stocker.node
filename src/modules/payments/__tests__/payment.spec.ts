import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import app from '@/app';
import { adminToken } from '@/tests/globalSetup';

describe('Payment API', () => {
  const newPaymentInput = {
    paymentDate: '2025-06-01T10:00:00Z',
    amount: 150.0,
    currencyId: 1, // EUR
    paymentMethodId: 2, // Carte Bancaire
    direction: 'inbound',
    customerId: 1, // Jean Dupont
    referenceNumber: 'TEST-PAY-001',
    notes: 'Paiement de test pour Jean Dupont',
    bankAccountId: 1, // Ajout d'un compte bancaire pour la validation
  };

  let createdPaymentId: string; // Payment ID est une chaîne (BIGINT)

  describe('POST /payments', () => {
    it('should record a new payment', async () => {
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newPaymentInput);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.amount).toBe(newPaymentInput.amount);
      expect(res.body.data.currencyId).toBe(newPaymentInput.currencyId);
      createdPaymentId = res.body.data.id;
    });

    it('should return 400 for missing required fields', async () => {
      const invalidInput = { ...newPaymentInput, amount: undefined };
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidInput);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('GET /payments', () => {
    it('should return a list of payments', async () => {
      const res = await request(app)
        .get('/api/v1/payments')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data.payments)).toBe(true);
      expect(res.body.data.payments.length).toBeGreaterThan(0);
    });
  });

  describe('GET /payments/:id', () => {
    it('should return a specific payment by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/payments/${createdPaymentId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id', createdPaymentId);
      expect(res.body.data.amount).toBe(newPaymentInput.amount);
    });

    it('should return 404 for a non-existent payment ID', async () => {
      const res = await request(app)
        .get('/api/v1/payments/9999999999999999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for an invalid payment ID format', async () => {
      const res = await request(app)
        .get('/api/v1/payments/abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('DELETE /payments/:id', () => {
    let paymentToDeleteId: string;
    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newPaymentInput);
      paymentToDeleteId = res.body.data.id;
      expect(res.status).toBe(201);
    });

    it('should delete (void/reverse) a payment by ID', async () => {
      const res = await request(app)
        .delete(`/api/v1/payments/${paymentToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);

      // Verify it's actually deleted (or marked as voided)
      const getRes = await request(app)
        .get(`/api/v1/payments/${paymentToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.status).toBe(404); // Assuming it returns 404 after soft delete
    });

    it('should return 404 for deleting a non-existent payment ID', async () => {
      const res = await request(app)
        .delete('/api/v1/payments/99999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for an invalid payment ID format', async () => {
      const res = await request(app)
        .delete('/api/v1/payments/abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });
  });
});

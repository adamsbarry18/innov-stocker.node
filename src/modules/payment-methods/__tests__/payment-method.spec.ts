import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import app from '@/app';
import { adminToken } from '@/tests/globalSetup';

describe('PaymentMethod API', () => {
  const testMethod = {
    name: 'Test Method',
    type: 'other',
    isActive: true,
  };

  let createdMethodId: number;

  describe('POST /payment-methods', () => {
    it('should create a new payment method (as admin)', async () => {
      const res = await request(app)
        .post('/api/v1/payment-methods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testMethod);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toMatchObject({
        name: testMethod.name,
        type: testMethod.type,
        isActive: testMethod.isActive,
      });
      createdMethodId = res.body.data.id;
    });

    it('should return 400 for missing required name', async () => {
      const res = await request(app)
        .post('/api/v1/payment-methods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...testMethod, name: '' });
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for missing required type', async () => {
      const res = await request(app)
        .post('/api/v1/payment-methods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...testMethod, type: undefined });
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for invalid type', async () => {
      const res = await request(app)
        .post('/api/v1/payment-methods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...testMethod, type: 'invalid_type' });
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for duplicate name', async () => {
      const res = await request(app)
        .post('/api/v1/payment-methods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testMethod);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('GET /payment-methods', () => {
    it('should return a list of payment methods (as admin)', async () => {
      const res = await request(app)
        .get('/api/v1/payment-methods')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data.methods)).toBe(true);
    });

    it('should support pagination, sorting, and filtering', async () => {
      const res = await request(app)
        .get(
          '/api/v1/payment-methods?page=1&limit=5&sortBy=name&order=asc&filter[name]=Test Method',
        )
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data.methods)).toBe(true);
      expect(res.body).toHaveProperty('meta');
      expect(res.body.meta).toHaveProperty('pagination');
      expect(res.body.meta.pagination).toHaveProperty('page', 1);
      expect(res.body.meta.pagination).toHaveProperty('limit', 5);
      expect(res.body.meta).toHaveProperty('sorting');
      expect(res.body.meta.sorting[0]).toMatchObject({ field: 'name', direction: 'ASC' });
      expect(res.body.meta).toHaveProperty('filters');
      expect(res.body.meta.filters[0]).toMatchObject({
        field: 'name',
        operator: 'eq',
        value: 'Test Method',
      });
    });
  });

  describe('GET /payment-methods/:id', () => {
    it('should return a specific payment method by ID (as admin)', async () => {
      const res = await request(app)
        .get(`/api/v1/payment-methods/${createdMethodId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id', createdMethodId);
      expect(res.body.data).toMatchObject({
        name: testMethod.name,
        type: testMethod.type,
      });
    });

    it('should return 404 for a non-existent payment method ID', async () => {
      const res = await request(app)
        .get('/api/v1/payment-methods/99999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for an invalid payment method ID format', async () => {
      const res = await request(app)
        .get('/api/v1/payment-methods/abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('PUT /payment-methods/:id', () => {
    const updatedMethod = {
      name: 'Updated Method',
      type: 'cash',
      isActive: false,
    };

    it('should update a payment method by ID (as admin)', async () => {
      const res = await request(app)
        .put(`/api/v1/payment-methods/${createdMethodId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedMethod);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id', createdMethodId);
      expect(res.body.data).toMatchObject(updatedMethod);
    });

    it('should return 404 for updating a non-existent payment method ID', async () => {
      const res = await request(app)
        .put('/api/v1/payment-methods/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedMethod);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for an invalid payment method ID format', async () => {
      const res = await request(app)
        .put('/api/v1/payment-methods/abc')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedMethod);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for invalid update data', async () => {
      const res = await request(app)
        .put(`/api/v1/payment-methods/${createdMethodId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...updatedMethod, name: '' });
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('DELETE /payment-methods/:id', () => {
    let methodToDeleteId: number;
    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/payment-methods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'ToDelete',
          type: 'card',
          isActive: true,
        });
      methodToDeleteId = res.body.data.id;
    });

    it('should soft delete a payment method by ID (as admin)', async () => {
      const res = await request(app)
        .delete(`/api/v1/payment-methods/${methodToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);
    });

    it('should return 404 for deleting a non-existent payment method ID', async () => {
      const res = await request(app)
        .delete('/api/v1/payment-methods/99999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for an invalid payment method ID format', async () => {
      const res = await request(app)
        .delete('/api/v1/payment-methods/abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 if the payment method has associated payments', async () => {
      const paymentMethodInUseId = 2; // ID de la méthode de paiement 'Carte Bancaire' utilisée dans 2-datas.sql
      const res = await request(app)
        .delete(`/api/v1/payment-methods/${paymentMethodInUseId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });
  });
});

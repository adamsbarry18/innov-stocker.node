import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import app from '@/app';
import { adminToken } from '@/tests/globalSetup';

describe('Customer API', () => {
  const testCustomer = {
    email: 'customer@example.com',
    firstName: 'John',
    lastName: 'Doe',
    companyName: 'Test Company',
    customerGroupId: 1,
    phoneNumber: '0123456789',
    notes: 'VIP customer',
    billingAddressId: 4, // Ajout de l'ID de l'adresse de facturation
    defaultCurrencyId: 1, // Ajout de l'ID de la devise par défaut
  };

  let createdCustomerId: number;

  describe('POST /customers', () => {
    it('should create a new customer (as admin)', async () => {
      const res = await request(app)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testCustomer);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toMatchObject({
        email: testCustomer.email,
        firstName: testCustomer.firstName,
        lastName: testCustomer.lastName,
        companyName: testCustomer.companyName,
        customerGroupId: testCustomer.customerGroupId,
      });
      createdCustomerId = res.body.data.id;
    });

    it('should fail to create a customer without authentication', async () => {
      const res = await request(app).post('/api/v1/customers').send(testCustomer);
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for invalid customer data', async () => {
      const res = await request(app)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...testCustomer, email: '' });
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('GET /customers', () => {
    it('should return a list of customers (as admin)', async () => {
      const res = await request(app)
        .get('/api/v1/customers')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data.customers)).toBe(true);
    });

    it('should fail to return customers without authentication', async () => {
      const res = await request(app).get('/api/v1/customers');
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });

    it('should support pagination, sorting, and filtering', async () => {
      const res = await request(app)
        .get(
          '/api/v1/customers?page=1&limit=5&sortBy=companyName&order=asc&filter[companyName]=Test Company',
        )
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data.customers)).toBe(true);
      expect(res.body).toHaveProperty('meta');
      expect(res.body.meta).toHaveProperty('pagination');
      expect(res.body.meta.pagination).toHaveProperty('page', 1);
      expect(res.body.meta.pagination).toHaveProperty('limit', 5);
      expect(res.body.meta).toHaveProperty('sorting');
      expect(res.body.meta.sorting[0]).toMatchObject({ field: 'companyName', direction: 'ASC' });
      expect(res.body.meta).toHaveProperty('filters');
      expect(res.body.meta.filters[0]).toMatchObject({
        field: 'companyName',
        operator: 'eq',
        value: 'Test Company',
      });
    });
  });

  describe('GET /customers/:id', () => {
    it('should return a specific customer by ID (as admin)', async () => {
      const res = await request(app)
        .get(`/api/v1/customers/${createdCustomerId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id', createdCustomerId);
      expect(res.body.data).toMatchObject({
        email: testCustomer.email,
        firstName: testCustomer.firstName,
        lastName: testCustomer.lastName,
      });
    });

    it('should return 404 for a non-existent customer ID', async () => {
      const res = await request(app)
        .get('/api/v1/customers/99999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for an invalid customer ID format', async () => {
      const res = await request(app)
        .get('/api/v1/customers/abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should fail to get a customer without authentication', async () => {
      const res = await request(app).get(`/api/v1/customers/${createdCustomerId}`);
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('PUT /customers/:id', () => {
    const updatedCustomer = {
      email: 'updated@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      companyName: 'Updated Company',
      customerGroupId: 1,
      phoneNumber: '0987654321',
      notes: 'Updated notes',
      defaultCurrencyId: 1, // Ajout de l'ID de la devise par défaut
    };

    it('should update a customer by ID (as admin)', async () => {
      const res = await request(app)
        .put(`/api/v1/customers/${createdCustomerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedCustomer);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id', createdCustomerId);
      expect(res.body.data).toMatchObject({
        email: updatedCustomer.email,
        firstName: updatedCustomer.firstName,
        lastName: updatedCustomer.lastName,
      });
    });

    it('should return 404 for updating a non-existent customer ID', async () => {
      const res = await request(app)
        .put('/api/v1/customers/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedCustomer);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for an invalid customer ID format', async () => {
      const res = await request(app)
        .put('/api/v1/customers/abc')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedCustomer);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for invalid update data', async () => {
      const res = await request(app)
        .put(`/api/v1/customers/${createdCustomerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...updatedCustomer, email: '' });
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should fail to update a customer without authentication', async () => {
      const res = await request(app)
        .put(`/api/v1/customers/${createdCustomerId}`)
        .send(updatedCustomer);
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('DELETE /customers/:id', () => {
    let customerToDeleteId: number;
    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...testCustomer,
          email: 'delete@example.com',
          firstName: 'ToDelete',
        });
      customerToDeleteId = res.body.data.id;
    });

    it('should soft delete a customer by ID (as admin)', async () => {
      const res = await request(app)
        .delete(`/api/v1/customers/${customerToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);
    });

    it('should return 404 for deleting a non-existent customer ID', async () => {
      const res = await request(app)
        .delete('/api/v1/customers/99999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for an invalid customer ID format', async () => {
      const res = await request(app)
        .delete('/api/v1/customers/abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should fail to delete a customer without authentication', async () => {
      const res = await request(app).delete(`/api/v1/customers/${customerToDeleteId}`);
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 if the customer has associated sales orders or invoices', async () => {
      const customerId = 3; // ID du client avec dépendances ajouté dans 2-datas.sql
      const res = await request(app)
        .delete(`/api/v1/customers/${customerId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });
  });
});

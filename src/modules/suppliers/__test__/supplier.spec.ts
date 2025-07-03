import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import app from '@/app';
import { adminToken } from '@/tests/globalSetup';

describe('Supplier API', () => {
  const testSupplier = {
    name: 'Test Supplier',
    contactPersonName: 'John Doe',
    email: 'supplier@example.com',
    phoneNumber: '0123456789',
    website: 'https://supplier.com',
    vatNumber: 'FR123456789',
    siretNumber: '12345678900011',
    defaultCurrencyId: 1,
    defaultPaymentTermsDays: 30,
    addressId: 1,
    notes: 'Preferred supplier',
  };

  let createdSupplierId: number;

  describe('POST /suppliers', () => {
    it('should create a new supplier (as admin)', async () => {
      const res = await request(app)
        .post('/api/v1/suppliers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testSupplier);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toMatchObject({
        name: testSupplier.name,
        email: testSupplier.email.toLowerCase(),
        defaultCurrencyId: testSupplier.defaultCurrencyId,
      });
      createdSupplierId = res.body.data.id;
    });

    it('should return 400 for invalid supplier data', async () => {
      const res = await request(app)
        .post('/api/v1/suppliers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...testSupplier, name: '' });
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('GET /suppliers', () => {
    it('should return a list of suppliers (as admin)', async () => {
      const res = await request(app)
        .get('/api/v1/suppliers')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data.suppliers)).toBe(true);
    });

    it('should support pagination, sorting, and filtering', async () => {
      const res = await request(app)
        .get('/api/v1/suppliers?page=1&limit=5&sortBy=name&order=asc&filter[name]=Test Supplier')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data.suppliers)).toBe(true);
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
        value: 'Test Supplier',
      });
    });
  });

  describe('GET /suppliers/:id', () => {
    it('should return a specific supplier by ID (as admin)', async () => {
      const res = await request(app)
        .get(`/api/v1/suppliers/${createdSupplierId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id', createdSupplierId);
      expect(res.body.data).toMatchObject({
        name: testSupplier.name,
        email: testSupplier.email.toLowerCase(),
      });
    });

    it('should return 404 for a non-existent supplier ID', async () => {
      const res = await request(app)
        .get('/api/v1/suppliers/99999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for an invalid supplier ID format', async () => {
      const res = await request(app)
        .get('/api/v1/suppliers/abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('PUT /suppliers/:id', () => {
    const updatedSupplier = {
      name: 'Supplier Updated',
      contactPersonName: 'Jane Doe',
      email: 'updated@example.com',
      phoneNumber: '0987654321',
      website: 'https://updated.com',
      vatNumber: 'FR987654321',
      siretNumber: '98765432100022',
      defaultCurrencyId: 1,
      defaultPaymentTermsDays: 45,
      addressId: 1,
      notes: 'Updated notes',
    };

    it('should update a supplier by ID (as admin)', async () => {
      const res = await request(app)
        .put(`/api/v1/suppliers/${createdSupplierId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedSupplier);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id', createdSupplierId);
      expect(res.body.data).toMatchObject({
        name: updatedSupplier.name,
        email: updatedSupplier.email.toLowerCase(),
      });
    });

    it('should return 404 for updating a non-existent supplier ID', async () => {
      const res = await request(app)
        .put('/api/v1/suppliers/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedSupplier);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for an invalid supplier ID format', async () => {
      const res = await request(app)
        .put('/api/v1/suppliers/abc')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedSupplier);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for invalid update data', async () => {
      const res = await request(app)
        .put(`/api/v1/suppliers/${createdSupplierId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...updatedSupplier, name: '' });
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('DELETE /suppliers/:id', () => {
    let supplierToDeleteId: number;
    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/suppliers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...testSupplier,
          email: 'delete@example.com',
          name: 'ToDelete',
        });
      supplierToDeleteId = res.body.data.id;
    });

    it('should soft delete a supplier by ID (as admin)', async () => {
      const res = await request(app)
        .delete(`/api/v1/suppliers/${supplierToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);
    });

    it('should return 404 for deleting a non-existent supplier ID', async () => {
      const res = await request(app)
        .delete('/api/v1/suppliers/99999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for an invalid supplier ID format', async () => {
      const res = await request(app)
        .delete('/api/v1/suppliers/abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 if the supplier has associated records', async () => {
      const supplierIdWithDependencies = 1; // ID du fournisseur avec dépendances ajouté dans 2-datas.sql
      const res = await request(app)
        .delete(`/api/v1/suppliers/${supplierIdWithDependencies}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
      expect(res.body.data).toContain('is in use and cannot be deleted');
    });
  });
});

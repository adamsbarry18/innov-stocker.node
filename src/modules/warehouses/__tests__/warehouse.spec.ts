import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import app from '@/app';
import { adminToken } from '@/tests/globalSetup';

describe('Warehouse API', () => {
  // Utiliser des IDs valides de la base de test (voir 2-datas.sql)
  const testWarehouse = {
    name: 'Test Warehouse',
    code: 'TEST-WHS',
    addressId: 7, // Doit exister dans la table addresses
    managerId: 1, // Doit exister dans la table user
    capacityNotes: 'Test capacity notes',
  };

  let createdWarehouseId: number;

  describe('POST /warehouses', () => {
    it('should create a new warehouse (as admin)', async () => {
      const res = await request(app)
        .post('/api/v1/warehouses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testWarehouse);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toMatchObject({
        name: testWarehouse.name,
        code: testWarehouse.code,
        addressId: testWarehouse.addressId,
        managerId: testWarehouse.managerId,
        capacityNotes: testWarehouse.capacityNotes,
      });
      createdWarehouseId = res.body.data.id;
    });

    it('should fail to create a warehouse without authentication', async () => {
      const res = await request(app).post('/api/v1/warehouses').send(testWarehouse);
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for missing required name', async () => {
      const res = await request(app)
        .post('/api/v1/warehouses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...testWarehouse, name: '' });
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for missing required addressId', async () => {
      const { ...rest } = testWarehouse;
      const res = await request(app)
        .post('/api/v1/warehouses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(rest);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for duplicate name', async () => {
      const res = await request(app)
        .post('/api/v1/warehouses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testWarehouse);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for duplicate code', async () => {
      const res = await request(app)
        .post('/api/v1/warehouses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...testWarehouse, name: 'Another Warehouse' });
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('GET /warehouses', () => {
    it('should return a list of warehouses (as admin)', async () => {
      const res = await request(app)
        .get('/api/v1/warehouses')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data.warehouses)).toBe(true);
    });

    it('should fail to return warehouses without authentication', async () => {
      const res = await request(app).get('/api/v1/warehouses');
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });

    it('should support pagination, sorting, and filtering', async () => {
      const res = await request(app)
        .get('/api/v1/warehouses?page=1&limit=2&sortBy=name&order=asc&filter[name]=Test Warehouse')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data.warehouses)).toBe(true);
      expect(res.body).toHaveProperty('meta');
      expect(res.body.meta).toHaveProperty('pagination');
      expect(res.body.meta.pagination).toHaveProperty('page', 1);
      expect(res.body.meta.pagination).toHaveProperty('limit', 2);
      expect(res.body.meta).toHaveProperty('sorting');
      expect(res.body.meta.sorting[0]).toMatchObject({ field: 'name', direction: 'ASC' });
      expect(res.body.meta).toHaveProperty('filters');
      expect(res.body.meta.filters[0]).toMatchObject({
        field: 'name',
        operator: 'eq',
        value: 'Test Warehouse',
      });
    });
  });

  describe('GET /warehouses/:id', () => {
    it('should return a specific warehouse by ID (as admin)', async () => {
      const res = await request(app)
        .get(`/api/v1/warehouses/${createdWarehouseId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id', createdWarehouseId);
      expect(res.body.data).toMatchObject({
        name: testWarehouse.name,
        code: testWarehouse.code,
      });
    });

    it('should return 404 for a non-existent warehouse ID', async () => {
      const res = await request(app)
        .get('/api/v1/warehouses/99999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for an invalid warehouse ID format', async () => {
      const res = await request(app)
        .get('/api/v1/warehouses/abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should fail to get a warehouse without authentication', async () => {
      const res = await request(app).get(`/api/v1/warehouses/${createdWarehouseId}`);
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('PUT /warehouses/:id', () => {
    const updatedWarehouse = {
      name: 'Updated Warehouse',
      code: 'UPDATED-WHS',
      addressId: 8,
      managerId: 2,
      capacityNotes: 'Updated notes',
    };

    it('should update a warehouse by ID (as admin)', async () => {
      const res = await request(app)
        .put(`/api/v1/warehouses/${createdWarehouseId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedWarehouse);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id', createdWarehouseId);
      expect(res.body.data).toMatchObject(updatedWarehouse);
    });

    it('should return 404 for updating a non-existent warehouse ID', async () => {
      const res = await request(app)
        .put('/api/v1/warehouses/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedWarehouse);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for an invalid warehouse ID format', async () => {
      const res = await request(app)
        .put('/api/v1/warehouses/abc')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedWarehouse);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for invalid update data', async () => {
      const res = await request(app)
        .put(`/api/v1/warehouses/${createdWarehouseId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...updatedWarehouse, name: '' });
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should fail to update a warehouse without authentication', async () => {
      const res = await request(app)
        .put(`/api/v1/warehouses/${createdWarehouseId}`)
        .send(updatedWarehouse);
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('DELETE /warehouses/:id', () => {
    let warehouseToDeleteId: number;
    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/warehouses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'ToDelete Warehouse',
          code: 'DEL-WHS',
          addressId: 8,
          managerId: 2,
          capacityNotes: 'To be deleted',
        });
      warehouseToDeleteId = res.body.data.id;
    });

    it('should soft delete a warehouse by ID (as admin)', async () => {
      const res = await request(app)
        .delete(`/api/v1/warehouses/${warehouseToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);
    });

    it('should return 404 for deleting a non-existent warehouse ID', async () => {
      const res = await request(app)
        .delete('/api/v1/warehouses/99999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for an invalid warehouse ID format', async () => {
      const res = await request(app)
        .delete('/api/v1/warehouses/abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should fail to delete a warehouse without authentication', async () => {
      const res = await request(app).delete(`/api/v1/warehouses/${warehouseToDeleteId}`);
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 if the warehouse has associated records', async () => {
      const warehouseIdWithDependencies = 1; // ID de l'entrepôt avec dépendances ajouté dans 2-datas.sql
      const res = await request(app)
        .delete(`/api/v1/warehouses/${warehouseIdWithDependencies}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
      expect(res.body.data).toContain('is in use and cannot be deleted');
    });
  });
});

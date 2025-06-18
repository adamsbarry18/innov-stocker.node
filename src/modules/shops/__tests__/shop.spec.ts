import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import app from '@/app';
import { adminToken } from '@/tests/globalSetup';

describe('Shop API', () => {
  // Utiliser des IDs valides de la base de test (voir 2-datas.sql)
  const testShop = {
    name: 'Test Shop',
    code: 'TEST-SHOP',
    addressId: 9, // Doit exister dans la table addresses
    managerId: 2, // Doit exister dans la table user
    openingHoursNotes: 'Ouvert 9h-18h',
  };

  let createdShopId: number;

  describe('POST /shops', () => {
    it('should create a new shop (as admin)', async () => {
      const res = await request(app)
        .post('/api/v1/shops')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testShop);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toMatchObject({
        name: testShop.name,
        code: testShop.code,
        addressId: testShop.addressId,
        managerId: testShop.managerId,
        openingHoursNotes: testShop.openingHoursNotes,
      });
      createdShopId = res.body.data.id;
    });

    it('should fail to create a shop without authentication', async () => {
      const res = await request(app).post('/api/v1/shops').send(testShop);
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for missing required name', async () => {
      const res = await request(app)
        .post('/api/v1/shops')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...testShop, name: '' });
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for missing required addressId', async () => {
      const { ...rest } = testShop;
      const res = await request(app)
        .post('/api/v1/shops')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(rest);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for duplicate name', async () => {
      const res = await request(app)
        .post('/api/v1/shops')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testShop);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for duplicate code', async () => {
      const res = await request(app)
        .post('/api/v1/shops')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...testShop, name: 'Another Shop' });
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('GET /shops', () => {
    it('should return a list of shops (as admin)', async () => {
      const res = await request(app)
        .get('/api/v1/shops')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data.shops)).toBe(true);
    });

    it('should fail to return shops without authentication', async () => {
      const res = await request(app).get('/api/v1/shops');
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });

    it('should support pagination, sorting, and filtering', async () => {
      const res = await request(app)
        .get('/api/v1/shops?page=1&limit=2&sortBy=name&order=asc&filter[name]=Test Shop')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data.shops)).toBe(true);
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
        value: 'Test Shop',
      });
    });
  });

  describe('GET /shops/:id', () => {
    it('should return a specific shop by ID (as admin)', async () => {
      const res = await request(app)
        .get(`/api/v1/shops/${createdShopId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id', createdShopId);
      expect(res.body.data).toMatchObject({
        name: testShop.name,
        code: testShop.code,
      });
    });

    it('should return 404 for a non-existent shop ID', async () => {
      const res = await request(app)
        .get('/api/v1/shops/99999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for an invalid shop ID format', async () => {
      const res = await request(app)
        .get('/api/v1/shops/abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should fail to get a shop without authentication', async () => {
      const res = await request(app).get(`/api/v1/shops/${createdShopId}`);
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('PUT /shops/:id', () => {
    const updatedShop = {
      name: 'Updated Shop',
      code: 'UPDATED-SHOP',
      addressId: 10,
      managerId: 1,
      openingHoursNotes: 'Ouvert 10h-19h',
    };

    it('should update a shop by ID (as admin)', async () => {
      const res = await request(app)
        .put(`/api/v1/shops/${createdShopId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedShop);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id', createdShopId);
      expect(res.body.data).toMatchObject(updatedShop);
    });

    it('should return 404 for updating a non-existent shop ID', async () => {
      const res = await request(app)
        .put('/api/v1/shops/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedShop);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for an invalid shop ID format', async () => {
      const res = await request(app)
        .put('/api/v1/shops/abc')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedShop);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for invalid update data', async () => {
      const res = await request(app)
        .put(`/api/v1/shops/${createdShopId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...updatedShop, name: '' });
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should fail to update a shop without authentication', async () => {
      const res = await request(app).put(`/api/v1/shops/${createdShopId}`).send(updatedShop);
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('DELETE /shops/:id', () => {
    let shopToDeleteId: number;
    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/shops')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'ToDelete Shop',
          code: 'DEL-SHOP',
          addressId: 10,
          managerId: 1,
          openingHoursNotes: 'To be deleted',
        });
      shopToDeleteId = res.body.data.id;
    });

    it('should soft delete a shop by ID (as admin)', async () => {
      const res = await request(app)
        .delete(`/api/v1/shops/${shopToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);
    });

    it('should return 404 for deleting a non-existent shop ID', async () => {
      const res = await request(app)
        .delete('/api/v1/shops/99999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for an invalid shop ID format', async () => {
      const res = await request(app)
        .delete('/api/v1/shops/abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should fail to delete a shop without authentication', async () => {
      const res = await request(app).delete(`/api/v1/shops/${shopToDeleteId}`);
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });
  });
});

import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import app from '@/app';
import { adminToken } from '@/tests/globalSetup';

describe('CashRegister API', () => {
  const testRegister = {
    name: 'Caisse Test',
    shopId: 1,
    currencyId: 1,
    isActive: true,
  };

  let createdRegisterId: number;

  describe('POST /cash-registers', () => {
    it('should create a new cash register (as admin)', async () => {
      const res = await request(app)
        .post('/api/v1/cash-registers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testRegister);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toMatchObject({
        name: testRegister.name,
        shopId: testRegister.shopId,
        currencyId: testRegister.currencyId,
        isActive: testRegister.isActive,
      });
      createdRegisterId = res.body.data.id;
    });

    it('should fail to create a cash register without authentication', async () => {
      const res = await request(app).post('/api/v1/cash-registers').send(testRegister);
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for missing required name', async () => {
      const res = await request(app)
        .post('/api/v1/cash-registers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...testRegister, name: '' });
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for missing required currencyId', async () => {
      const { currencyId, ...partial } = testRegister;
      const res = await request(app)
        .post('/api/v1/cash-registers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(partial);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for duplicate name', async () => {
      const res = await request(app)
        .post('/api/v1/cash-registers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testRegister);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('GET /cash-registers', () => {
    it('should return a list of cash registers (as admin)', async () => {
      const res = await request(app)
        .get('/api/v1/cash-registers')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data.registers)).toBe(true);
    });

    it('should fail to return cash registers without authentication', async () => {
      const res = await request(app).get('/api/v1/cash-registers');
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });

    it('should support pagination, sorting, and filtering', async () => {
      const res = await request(app)
        .get('/api/v1/cash-registers?page=1&limit=5&sortBy=name&order=asc&filter[name]=Caisse Test')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data.registers)).toBe(true);
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
        value: 'Caisse Test',
      });
    });
  });

  describe('GET /cash-registers/:id', () => {
    it('should return a specific cash register by ID (as admin)', async () => {
      const res = await request(app)
        .get(`/api/v1/cash-registers/${createdRegisterId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id', createdRegisterId);
      expect(res.body.data).toMatchObject({
        name: testRegister.name,
        shopId: testRegister.shopId,
      });
    });

    it('should return 404 for a non-existent cash register ID', async () => {
      const res = await request(app)
        .get('/api/v1/cash-registers/99999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for an invalid cash register ID format', async () => {
      const res = await request(app)
        .get('/api/v1/cash-registers/abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should fail to get a cash register without authentication', async () => {
      const res = await request(app).get(`/api/v1/cash-registers/${createdRegisterId}`);
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('PUT /cash-registers/:id', () => {
    const updatedRegister = {
      name: 'Caisse Modifiée',
      shopId: 2,
      isActive: false,
    };

    it('should update a cash register by ID (as admin)', async () => {
      const res = await request(app)
        .put(`/api/v1/cash-registers/${createdRegisterId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedRegister);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id', createdRegisterId);
      expect(res.body.data).toMatchObject({
        name: updatedRegister.name,
        shopId: updatedRegister.shopId,
        isActive: updatedRegister.isActive,
      });
    });

    it('should return 404 for updating a non-existent cash register ID', async () => {
      const res = await request(app)
        .put('/api/v1/cash-registers/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedRegister);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for an invalid cash register ID format', async () => {
      const res = await request(app)
        .put('/api/v1/cash-registers/abc')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedRegister);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for invalid update data', async () => {
      const res = await request(app)
        .put(`/api/v1/cash-registers/${createdRegisterId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...updatedRegister, name: '' });
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should fail to update a cash register without authentication', async () => {
      const res = await request(app)
        .put(`/api/v1/cash-registers/${createdRegisterId}`)
        .send(updatedRegister);
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('DELETE /cash-registers/:id', () => {
    let registerToDeleteId: number;
    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/cash-registers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Caisse à Supprimer',
          shopId: 1,
          currencyId: 1,
          isActive: true,
        });
      registerToDeleteId = res.body.data.id;
    });

    it('should soft delete a cash register by ID (as admin)', async () => {
      const res = await request(app)
        .delete(`/api/v1/cash-registers/${registerToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);
    });

    it('should return 404 for deleting a non-existent cash register ID', async () => {
      const res = await request(app)
        .delete('/api/v1/cash-registers/99999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for an invalid cash register ID format', async () => {
      const res = await request(app)
        .delete('/api/v1/cash-registers/abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should fail to delete a cash register without authentication', async () => {
      const res = await request(app).delete(`/api/v1/cash-registers/${registerToDeleteId}`);
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });
  });
});

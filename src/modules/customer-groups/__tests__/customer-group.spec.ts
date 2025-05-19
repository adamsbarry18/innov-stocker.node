import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import app from '@/app';
import { adminToken } from '@/tests/globalSetup';

describe('CustomerGroup API', () => {
  const testGroup = {
    name: 'VIP',
    description: 'VIP customers',
    discountPercentage: 10,
  };

  let createdGroupId: number;

  describe('POST /customer-groups', () => {
    it('should create a new customer group (as user)', async () => {
      const res = await request(app)
        .post('/api/v1/customer-groups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testGroup);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toMatchObject(testGroup);
      createdGroupId = res.body.data.id;
    });

    it('should fail to create a group without authentication', async () => {
      const res = await request(app).post('/api/v1/customer-groups').send(testGroup);
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for invalid group data', async () => {
      const res = await request(app)
        .post('/api/v1/customer-groups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...testGroup, name: '' });
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('GET /customer-groups', () => {
    it('should return a list of customer groups (as user)', async () => {
      const res = await request(app)
        .get('/api/v1/customer-groups')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data.groups)).toBe(true);
    });

    it('should fail to return groups without authentication', async () => {
      const res = await request(app).get('/api/v1/customer-groups');
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });

    it('should support pagination, sorting, and filtering', async () => {
      const res = await request(app)
        .get('/api/v1/customer-groups?page=1&limit=5&sortBy=name&order=asc&filter[name]=VIP')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data.groups)).toBe(true);
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
        value: 'VIP',
      });
    });
  });

  describe('GET /customer-groups/:id', () => {
    it('should return a specific group by ID (as user)', async () => {
      const res = await request(app)
        .get(`/api/v1/customer-groups/${createdGroupId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id', createdGroupId);
      expect(res.body.data).toMatchObject(testGroup);
    });

    it('should return 404 for a non-existent group ID', async () => {
      const res = await request(app)
        .get('/api/v1/customer-groups/99999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for an invalid group ID format', async () => {
      const res = await request(app)
        .get('/api/v1/customer-groups/abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should fail to get a group without authentication', async () => {
      const res = await request(app).get(`/api/v1/customer-groups/${createdGroupId}`);
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('PUT /customer-groups/:id', () => {
    const updatedGroup = {
      name: 'VIP Updated',
      description: 'Updated description',
      discountPercentage: 15,
    };

    it('should update a group by ID (as user)', async () => {
      const res = await request(app)
        .put(`/api/v1/customer-groups/${createdGroupId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedGroup);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id', createdGroupId);
      expect(res.body.data).toMatchObject(updatedGroup);
    });

    it('should return 404 for updating a non-existent group ID', async () => {
      const res = await request(app)
        .put('/api/v1/customer-groups/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedGroup);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for an invalid group ID format', async () => {
      const res = await request(app)
        .put('/api/v1/customer-groups/abc')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedGroup);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for invalid update data', async () => {
      const res = await request(app)
        .put(`/api/v1/customer-groups/${createdGroupId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...updatedGroup, name: '' });
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should fail to update a group without authentication', async () => {
      const res = await request(app)
        .put(`/api/v1/customer-groups/${createdGroupId}`)
        .send(updatedGroup);
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('DELETE /customer-groups/:id', () => {
    let groupToDeleteId: number;
    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/customer-groups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'ToDelete',
          description: 'To be deleted',
          discountPercentage: 5,
        });
      groupToDeleteId = res.body.data.id;
    });

    it('should soft delete a group by ID (as user)', async () => {
      const res = await request(app)
        .delete(`/api/v1/customer-groups/${groupToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);
    });

    it('should return 404 for deleting a non-existent group ID', async () => {
      const res = await request(app)
        .delete('/api/v1/customer-groups/99999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for an invalid group ID format', async () => {
      const res = await request(app)
        .delete('/api/v1/customer-groups/abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should fail to delete a group without authentication', async () => {
      const res = await request(app).delete(`/api/v1/customer-groups/${groupToDeleteId}`);
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });
  });
});

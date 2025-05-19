import request from 'supertest';
import { describe, it, expect } from 'vitest';

import app from '@/app';
import { adminToken } from '@/tests/globalSetup';

describe('Address API', () => {
  // Define a test address payload
  const testAddress = {
    streetLine1: '123 Test St',
    city: 'Testville',
    postalCode: '12345',
    country: 'Testland',
  };

  let createdAddressId: number;

  // Clean up the created address after tests
  afterAll(async () => {
    if (createdAddressId) {
      await request(app)
        .delete(`/api/v1/addresses/${createdAddressId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
  });

  describe('POST /addresses', () => {
    it('should create a new address (as admin)', async () => {
      const res = await request(app)
        .post('/api/v1/addresses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testAddress);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toMatchObject(testAddress);
      createdAddressId = res.body.data.id; // Store ID for later tests
    });

    it('should fail to create a new address without authentication', async () => {
      const res = await request(app).post('/api/v1/addresses').send(testAddress);

      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for invalid address data (as admin)', async () => {
      const invalidAddress = { ...testAddress, city: '' }; // Invalid city
      const res = await request(app)
        .post('/api/v1/addresses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidAddress);

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
      // Depending on the validation implementation, you might check for specific error messages here
      // expect(res.body.message).toContain('city');
    });
  });

  describe('GET /addresses', () => {
    it('should return a list of addresses (as admin)', async () => {
      const res = await request(app)
        .get('/api/v1/addresses')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data.addresses)).toBe(true);
    });

    it('should fail to return a list of addresses without authentication', async () => {
      const res = await request(app).get('/api/v1/addresses');

      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });

    it('should support pagination, sorting, filtering, and searching', async () => {
      // This is a basic test; more comprehensive tests would cover specific scenarios
      const res = await request(app)
        .get(
          '/api/v1/addresses?page=1&limit=10&sortBy=city&order=asc&filter[city]=Testville&q=Test',
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data.addresses)).toBe(true);
      expect(res.body).toHaveProperty('meta');
      expect(res.body.meta).toHaveProperty('pagination');
      expect(res.body.meta.pagination).toHaveProperty('page', 1);
      expect(res.body.meta.pagination).toHaveProperty('limit', 10);
      expect(res.body.meta).toHaveProperty('sorting');
      expect(res.body.meta.sorting[0]).toMatchObject({ field: 'city', direction: 'ASC' });
      expect(res.body.meta).toHaveProperty('filters');
      expect(res.body.meta.filters[0]).toMatchObject({
        field: 'city',
        operator: 'eq',
        value: 'Testville',
      });
      expect(res.body.meta).toHaveProperty('searchQuery', 'Test');
    });
  });

  describe('GET /addresses/:id', () => {
    it('should return a specific address by ID (as admin)', async () => {
      const res = await request(app)
        .get(`/api/v1/addresses/${createdAddressId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id', createdAddressId);
      expect(res.body.data).toMatchObject(testAddress);
    });

    it('should return 404 for a non-existent address ID (as admin)', async () => {
      const nonExistentId = 9999;
      const res = await request(app)
        .get(`/api/v1/addresses/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toBe('Not found'); // Expect generic message due to pipe
    });

    it('should return 400 for an invalid address ID format (as admin)', async () => {
      const invalidId = 'abc';
      const res = await request(app)
        .get(`/api/v1/addresses/${invalidId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toBe('Bad request'); // Expect generic message due to pipe
    });

    it('should fail to get a specific address without authentication', async () => {
      const res = await request(app).get(`/api/v1/addresses/${createdAddressId}`);

      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('PUT /addresses/:id', () => {
    const updatedAddress = {
      streetLine1: '456 Updated St',
      city: 'Updateville',
      postalCode: '67890',
      country: 'Updatedland',
    };

    it('should update an address by ID (as admin)', async () => {
      const res = await request(app)
        .put(`/api/v1/addresses/${createdAddressId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedAddress);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id', createdAddressId);
      expect(res.body.data).toMatchObject(updatedAddress);
    });

    it('should return 404 for updating a non-existent address ID (as admin)', async () => {
      const nonExistentId = 9999;
      const res = await request(app)
        .put(`/api/v1/addresses/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedAddress);

      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toBe('Not found'); // Expect generic message due to pipe
    });

    it('should return 400 for an invalid address ID format (as admin)', async () => {
      const invalidId = 'abc';
      const res = await request(app)
        .put(`/api/v1/addresses/${invalidId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedAddress);

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toBe('Bad request'); // Expect generic message due to pipe
    });

    it('should return 400 for invalid update data (as admin)', async () => {
      const invalidUpdate = { ...updatedAddress, city: '' }; // Invalid city
      const res = await request(app)
        .put(`/api/v1/addresses/${createdAddressId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidUpdate);

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
      // Depending on the validation implementation, you might check for specific error messages here
      // expect(res.body.message).toContain('city');
    });

    it('should fail to update an address without authentication', async () => {
      const res = await request(app)
        .put(`/api/v1/addresses/${createdAddressId}`)
        .send(updatedAddress);

      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('DELETE /addresses/:id', () => {
    // Create a new address specifically for deletion test
    let addressToDeleteId: number;
    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/addresses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          streetLine1: '789 Delete St',
          city: 'Deleteville',
          postalCode: '98765',
          country: 'Deleteland',
        });
      addressToDeleteId = res.body.data.id;
    });

    it('should soft delete an address by ID (as admin)', async () => {
      const res = await request(app)
        .delete(`/api/v1/addresses/${addressToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
    });

    it('should return 404 for deleting a non-existent address ID (as admin)', async () => {
      const nonExistentId = 9999;
      const res = await request(app)
        .delete(`/api/v1/addresses/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toBe('Not found'); // Expect generic message due to pipe
    });

    it('should return 400 for an invalid address ID format (as admin)', async () => {
      const invalidId = 'abc';
      const res = await request(app)
        .delete(`/api/v1/addresses/${invalidId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toBe('Bad request'); // Expect generic message due to pipe
    });

    it('should fail to delete an address without authentication', async () => {
      const res = await request(app).delete(`/api/v1/addresses/${addressToDeleteId}`);

      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });
  });
});

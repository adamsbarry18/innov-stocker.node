import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import app from '@/app';
import { adminToken } from '@/tests/globalSetup';

describe('Product Category API', () => {
  // Define a test product category payload
  const testProductCategory = {
    name: 'Test Category',
    description: 'A category for testing purposes',
    parentCategoryId: null, // Assuming it's a root category initially
  };

  let createdCategoryId: number;

  describe('POST /product-categories', () => {
    it('should create a new product category (as admin)', async () => {
      const res = await request(app)
        .post('/api/v1/product-categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testProductCategory);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toMatchObject({
        name: testProductCategory.name,
        description: testProductCategory.description,
        parentCategoryId: testProductCategory.parentCategoryId,
      });
      createdCategoryId = res.body.data.id; // Store ID for later tests
    });

    it('should fail to create a new product category without authentication', async () => {
      const res = await request(app).post('/api/v1/product-categories').send(testProductCategory);

      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for invalid product category data (as admin)', async () => {
      const invalidCategory = { ...testProductCategory, name: '' }; // Invalid name
      const res = await request(app)
        .post('/api/v1/product-categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidCategory);

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('GET /product-categories', () => {
    it('should return a list of product categories (as admin)', async () => {
      const res = await request(app)
        .get('/api/v1/product-categories')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data.categories)).toBe(true);
      expect(res.body.data).toHaveProperty('total');
    });

    it('should fail to return a list of product categories without authentication', async () => {
      const res = await request(app).get('/api/v1/product-categories');

      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });

    it('should support pagination, sorting, and filtering (as admin)', async () => {
      const res = await request(app)
        .get('/api/v1/product-categories?page=1&limit=10&sortBy=name&order=asc&filter[name]=Test')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data.categories)).toBe(true);
      expect(res.body).toHaveProperty('meta');
      expect(res.body.meta).toHaveProperty('pagination');
      expect(res.body.meta.pagination).toHaveProperty('page', 1);
      expect(res.body.meta.pagination).toHaveProperty('limit', 10);
      expect(res.body.meta).toHaveProperty('sorting');
      expect(res.body.meta.sorting[0]).toMatchObject({ field: 'name', direction: 'ASC' });
      expect(res.body.meta).toHaveProperty('filters');
      expect(res.body.meta.filters[0]).toMatchObject({
        field: 'name',
        operator: 'eq',
        value: 'Test',
      });
    });
  });

  describe('GET /product-categories/:id', () => {
    // Create a child category before running the children test
    beforeAll(async () => {
      // Only create if parent exists
      if (createdCategoryId) {
        await request(app)
          .post('/api/v1/product-categories')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Child Category',
            description: 'A child category for testing',
            parentCategoryId: createdCategoryId,
          });
      }
    });

    it('should return a specific product category by ID (as admin)', async () => {
      const res = await request(app)
        .get(`/api/v1/product-categories/${createdCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id', createdCategoryId);
      expect(res.body.data).toMatchObject({
        name: testProductCategory.name,
        description: testProductCategory.description,
      });
    });

    it('should return 404 for a non-existent product category ID (as admin)', async () => {
      const nonExistentId = 9999;
      const res = await request(app)
        .get(`/api/v1/product-categories/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toBe('Not found');
    });

    it('should return 400 for an invalid product category ID format (as admin)', async () => {
      const invalidId = 'abc';
      const res = await request(app)
        .get(`/api/v1/product-categories/${invalidId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toBe('Bad request');
    });

    it('should fail to get a specific product category without authentication', async () => {
      const res = await request(app).get(`/api/v1/product-categories/${createdCategoryId}`);

      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });

    it('should include children if includeChildren=true (as admin)', async () => {
      // Now a child category is created in beforeAll above
      const res = await request(app)
        .get(`/api/v1/product-categories/${createdCategoryId}?includeChildren=true`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('children');
      expect(Array.isArray(res.body.data.children)).toBe(true);
      expect(res.body.data.children.length).toBeGreaterThan(0);
      expect(res.body.data.children[0]).toHaveProperty('parentCategoryId', createdCategoryId);
    });
  });

  describe('PUT /product-categories/:id', () => {
    const updatedProductCategory = {
      name: 'Updated Category',
      description: 'An updated description',
      parentCategoryId: null,
    };

    it('should update a product category by ID (as admin)', async () => {
      const res = await request(app)
        .put(`/api/v1/product-categories/${createdCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedProductCategory);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id', createdCategoryId);
      expect(res.body.data).toMatchObject(updatedProductCategory);
    });

    it('should return 404 for updating a non-existent product category ID (as admin)', async () => {
      const nonExistentId = 9999;
      const res = await request(app)
        .put(`/api/v1/product-categories/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedProductCategory);

      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toBe('Not found');
    });

    it('should return 400 for an invalid product category ID format (as admin)', async () => {
      const invalidId = 'abc';
      const res = await request(app)
        .put(`/api/v1/product-categories/${invalidId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedProductCategory);

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toBe('Bad request');
    });

    it('should return 400 for invalid update data (as admin)', async () => {
      const invalidUpdate = { ...updatedProductCategory, name: '' }; // Invalid name
      const res = await request(app)
        .put(`/api/v1/product-categories/${createdCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidUpdate);

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should fail to update a product category without authentication', async () => {
      const res = await request(app)
        .put(`/api/v1/product-categories/${createdCategoryId}`)
        .send(updatedProductCategory);

      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('DELETE /product-categories/:id', () => {
    // Create a new category specifically for deletion test
    let categoryToDeleteId: number;
    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/product-categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Category to Delete',
          description: 'This category will be deleted',
          parentCategoryId: null,
        });
      categoryToDeleteId = res.body.data.id;
    });

    it('should soft delete a product category by ID (as admin)', async () => {
      const res = await request(app)
        .delete(`/api/v1/product-categories/${categoryToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
    });

    it('should return 404 for deleting a non-existent product category ID (as admin)', async () => {
      const nonExistentId = 9999;
      const res = await request(app)
        .delete(`/api/v1/product-categories/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toBe('Not found');
    });

    it('should return 400 for an invalid product category ID format (as admin)', async () => {
      const invalidId = 'abc';
      const res = await request(app)
        .delete(`/api/v1/product-categories/${invalidId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toBe('Bad request');
    });

    it('should fail to delete a product category without authentication', async () => {
      const res = await request(app).delete(`/api/v1/product-categories/${categoryToDeleteId}`);

      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });
  });
});

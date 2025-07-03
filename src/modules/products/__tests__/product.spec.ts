import request from 'supertest';
import { describe, it, expect } from 'vitest';

import app from '@/app';
import { adminToken } from '@/tests/globalSetup';

describe('Products API', () => {
  const testProduct = {
    sku: 'TEST-SKU-001',
    name: 'Produit Test',
    productCategoryId: 1,
    unitOfMeasure: 'pièce',
    status: 'active',
    defaultPurchasePrice: 10.5,
    defaultSellingPriceHt: 19.99,
    defaultVatRatePercentage: 20.0,
  };

  let createdProductId: number;

  describe('POST /products', () => {
    it('should create a new product with required fields', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testProduct);

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.sku).toBe(testProduct.sku);
      expect(res.body.data.name).toBe(testProduct.name);
      createdProductId = res.body.data.id;
    });

    it('should fail to create a product without required fields', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Produit Incomplet' });

      expect(res.status).toBe(400);
      // expect(res.body.success).toBe(false); // Commented out for now
    });

    it('should fail to create a product with duplicate SKU', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testProduct);

      expect(res.status).toBe(400);
      // expect(res.body.success).toBe(false); // Commented out for now
    });
  });

  describe('GET /products', () => {
    it('should return a paginated list of products (as admin)', async () => {
      const res = await request(app)
        .get('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('products');
      expect(Array.isArray(res.body.data.products)).toBe(true);
      expect(res.body.data).toHaveProperty('total');
    });

    it('should filter products by name', async () => {
      const res = await request(app)
        .get('/api/v1/products?name=Produit')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /products/:id', () => {
    it('should return a product by id (as admin)', async () => {
      const res = await request(app)
        .get(`/api/v1/products/${createdProductId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id', createdProductId);
      expect(res.body.data).toHaveProperty('sku');
      expect(res.body.data).toHaveProperty('name');
    });

    it('should return 404 for non-existent product', async () => {
      const res = await request(app)
        .get('/api/v1/products/999999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id', async () => {
      const res = await request(app)
        .get('/api/v1/products/abc')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /products/:id', () => {
    const updateData = { name: 'Produit Test Modifié' };

    it('should update an existing product (as admin)', async () => {
      const res = await request(app)
        .put(`/api/v1/products/${createdProductId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id', createdProductId);
      expect(res.body.data.name).toBe(updateData.name);
    });

    it('should return 404 for updating a non-existent product', async () => {
      const res = await request(app)
        .put('/api/v1/products/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id', async () => {
      const res = await request(app)
        .put('/api/v1/products/abc')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /products/:id', () => {
    it('should soft delete a product (as admin)', async () => {
      const res = await request(app)
        .delete(`/api/v1/products/${createdProductId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
    });

    it('should return 404 for deleting a non-existent product', async () => {
      const res = await request(app)
        .delete('/api/v1/products/999999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id', async () => {
      const res = await request(app)
        .delete('/api/v1/products/abc')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });
  });
});

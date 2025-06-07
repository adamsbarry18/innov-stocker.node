import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import app from '@/app';
import { adminToken } from '@/tests/globalSetup';

describe('Product Suppliers API', () => {
  let testProductId: number;
  let testVariantId: number;
  let testSupplierId: number;
  let testCurrencyId: number;
  let createdProductSupplierLinkId: number;
  let createdVariantSupplierLinkId: number;

  const productSupplierPayloadBase = {
    supplierProductCode: 'SUP-PROD-001',
    purchasePrice: 50.75,
    isDefaultSupplier: false,
  };

  beforeAll(() => {
    // Assuming these IDs exist in the seeded test database (2-datas.sql)
    testProductId = 1; // Product 1 (Smartphone Modèle X)
    testVariantId = 2; // Variant 2 (Smartphone Modèle X - Vert)
    testSupplierId = 2; // Supplier 2 (Office Supplies Express)
    testCurrencyId = 1; // Currency 1 (EUR)
  });

  describe('POST /products/:productId/suppliers', () => {
    it('should add a supplier to a base product', async () => {
      const payload = {
        ...productSupplierPayloadBase,
        supplierId: testSupplierId,
        currencyId: testCurrencyId,
      };
      const res = await request(app)
        .post(`/api/v1/products/${testProductId}/suppliers`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id');
      createdProductSupplierLinkId = res.body.data.id;
      expect(res.body.data.productId).toBe(testProductId);
      expect(res.body.data.supplierId).toBe(testSupplierId);
      expect(res.body.data.purchasePrice).toBe(payload.purchasePrice);
    });

    it('should fail if product does not exist', async () => {
      const res = await request(app)
        .post(`/api/v1/products/999999/suppliers`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...productSupplierPayloadBase,
          supplierId: testSupplierId,
          currencyId: testCurrencyId,
        });
      expect(res.status).toBe(404);
    });

    it('should fail if supplier already linked to this product', async () => {
      const payload = {
        ...productSupplierPayloadBase,
        supplierId: testSupplierId,
        currencyId: testCurrencyId,
      };
      const res = await request(app)
        .post(`/api/v1/products/${testProductId}/suppliers`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /products/:productId/suppliers', () => {
    it('should list suppliers for a base product', async () => {
      const res = await request(app)
        .get(`/api/v1/products/${testProductId}/suppliers`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.some((ps: any) => ps.id === createdProductSupplierLinkId)).toBe(true);
    });
  });

  describe('POST /products/:productId/variants/:variantId/suppliers', () => {
    it('should add a supplier to a product variant', async () => {
      const payload = {
        ...productSupplierPayloadBase,
        supplierId: testSupplierId,
        currencyId: testCurrencyId,
        supplierProductCode: 'SUP-VAR-001',
        purchasePrice: 45.0,
      };
      const res = await request(app)
        .post(`/api/v1/products/${testProductId}/variants/${testVariantId}/suppliers`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id');
      createdVariantSupplierLinkId = res.body.data.id;
      expect(res.body.data.productVariantId).toBe(testVariantId);
      expect(res.body.data.supplierId).toBe(testSupplierId);
      expect(res.body.data.purchasePrice).toBe(payload.purchasePrice);
    });

    it('should fail if variant does not exist', async () => {
      const res = await request(app)
        .post(`/api/v1/products/${testProductId}/variants/999999/suppliers`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...productSupplierPayloadBase,
          supplierId: testSupplierId,
          currencyId: testCurrencyId,
        });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /products/:productId/variants/:variantId/suppliers', () => {
    it('should list suppliers for a product variant', async () => {
      const res = await request(app)
        .get(`/api/v1/products/${testProductId}/variants/${testVariantId}/suppliers`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.some((ps: any) => ps.id === createdVariantSupplierLinkId)).toBe(true);
    });
  });

  describe('GET /product-suppliers/:linkId', () => {
    it('should get a specific product-supplier link', async () => {
      const res = await request(app)
        .get(`/api/v1/product-suppliers/${createdProductSupplierLinkId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(createdProductSupplierLinkId);
    });
  });

  describe('PUT /product-suppliers/:linkId', () => {
    it('should update a product-supplier link', async () => {
      const updateData = { purchasePrice: 55.0, isDefaultSupplier: true };
      const res = await request(app)
        .put(`/api/v1/product-suppliers/${createdProductSupplierLinkId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);
      expect(res.status).toBe(200);
      expect(res.body.data.purchasePrice).toBe(updateData.purchasePrice);
      expect(res.body.data.isDefaultSupplier).toBe(true);
    });
  });

  describe('DELETE /product-suppliers/:linkId', () => {
    it('should delete a product-supplier link', async () => {
      const res = await request(app)
        .delete(`/api/v1/product-suppliers/${createdProductSupplierLinkId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);

      const getRes = await request(app)
        .get(`/api/v1/product-suppliers/${createdProductSupplierLinkId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.status).toBe(404);
    });
  });
});

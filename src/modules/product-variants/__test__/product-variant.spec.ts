import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import app from '@/app';
import { adminToken } from '@/tests/globalSetup';

describe('Product Variants API', () => {
  let testProductId: number;
  let createdVariantId: number;

  beforeAll(async () => {
    // Assuming these IDs exist in the seeded test database (2-datas.sql)
    testProductId = 1;
  });

  const testVariantPayloadBase = {
    skuVariant: `VARSKU-${Date.now()}`,
    nameVariant: 'Variante Test Rouge S',
    attributes: { couleur: 'Rouge', taille: 'S' },
    purchasePrice: 12.0,
    sellingPriceHt: 22.0,
  };

  describe('POST /products/:productId/variants', () => {
    it('should create a new variant for a product', async () => {
      const payload = { ...testVariantPayloadBase, skuVariant: `VAR-${Date.now()}-1` };
      const res = await request(app)
        .post(`/api/v1/products/${testProductId}/variants`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id');
      createdVariantId = res.body.data.id;
      expect(res.body.data.skuVariant).toBe(payload.skuVariant);
      expect(res.body.data.nameVariant).toBe(payload.nameVariant);
      expect(res.body.data.productId).toBe(testProductId);
    });

    it('should fail to create a variant for a non-existent product', async () => {
      const res = await request(app)
        .post(`/api/v1/products/999999/variants`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testVariantPayloadBase);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
    });

    it('should fail to create a variant with a duplicate SKU', async () => {
      // Use the SKU from the first successfully created variant
      const payloadWithExistingSku = {
        ...testVariantPayloadBase,
        skuVariant: (
          await request(app)
            .get(`/api/v1/products/${testProductId}/variants/${createdVariantId}`)
            .set('Authorization', `Bearer ${adminToken}`)
        ).body.data.skuVariant,
      };
      const res = await request(app)
        .post(`/api/v1/products/${testProductId}/variants`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payloadWithExistingSku);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('GET /products/:productId/variants', () => {
    it('should list all variants for a product', async () => {
      const res = await request(app)
        .get(`/api/v1/products/${testProductId}/variants`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0); // Assuming at least one variant was created
      expect(res.body.data[0].productId).toBe(testProductId);
    });

    it('should return 404 if product not found when listing variants', async () => {
      const res = await request(app)
        .get(`/api/v1/products/999999/variants`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /products/:productId/variants/:variantId', () => {
    it('should get a specific variant by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/products/${testProductId}/variants/${createdVariantId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id', createdVariantId);
      expect(res.body.data.productId).toBe(testProductId);
    });

    it('should return 404 for non-existent variant ID', async () => {
      const res = await request(app)
        .get(`/api/v1/products/${testProductId}/variants/999999`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /products/:productId/variants/:variantId', () => {
    const updateData = { nameVariant: `Updated Variant Name ${Date.now()}`, sellingPriceHt: 25.99 };
    it('should update a product variant', async () => {
      const res = await request(app)
        .put(`/api/v1/products/${testProductId}/variants/${createdVariantId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.id).toBe(createdVariantId);
      expect(res.body.data.nameVariant).toBe(updateData.nameVariant);
      expect(res.body.data.sellingPriceHt).toBe(updateData.sellingPriceHt);
    });

    it('should return 404 if variant to update not found', async () => {
      const res = await request(app)
        .put(`/api/v1/products/${testProductId}/variants/999999`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /products/:productId/variants/:variantId', () => {
    let variantToDeleteId: number;
    beforeAll(async () => {
      // Create a variant specifically for deletion test
      const payload = {
        ...testVariantPayloadBase,
        skuVariant: `VAR-DEL-${Date.now()}`,
        nameVariant: 'Variant à Supprimer',
      };
      const res = await request(app)
        .post(`/api/v1/products/${testProductId}/variants`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);
      variantToDeleteId = res.body.data.id;
    });

    it('should delete a product variant', async () => {
      const res = await request(app)
        .delete(`/api/v1/products/${testProductId}/variants/${variantToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);
    });

    it('should return 404 when trying to get a deleted variant', async () => {
      const res = await request(app)
        .get(`/api/v1/products/${testProductId}/variants/${variantToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });
});

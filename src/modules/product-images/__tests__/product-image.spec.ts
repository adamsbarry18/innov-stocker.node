import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import app from '@/app';
import { adminToken } from '@/tests/globalSetup';

describe('Product Images API', () => {
  let testProductId: number;
  let createdImageId: number;
  let anotherImageId: number;

  const testImagePayload1 = {
    imageUrl: 'https://example.com/image1.jpg',
    altText: 'Première image de test',
    isPrimary: true,
  };
  const testImagePayload2 = {
    imageUrl: 'https://example.com/image2.png',
    altText: 'Seconde image de test',
    isPrimary: false,
  };

  beforeAll(() => {
    // Assuming these IDs exist in the seeded test database (2-datas.sql)
    testProductId = 1;
  });

  describe('POST /products/:productId/images', () => {
    it('should add a new image to a product and set it as primary if first (as admin)', async () => {
      const res = await request(app)
        .post(`/api/v1/products/${testProductId}/images`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testImagePayload1);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id');
      createdImageId = res.body.data.id;
      expect(res.body.data.imageUrl).toBe(testImagePayload1.imageUrl);
      expect(res.body.data.isPrimary).toBe(true); // Should be true as it's the first or explicitly set
      expect(res.body.data.productId).toBe(testProductId);
    });

    it('should add another image and not set it as primary if not specified (as admin)', async () => {
      const payload = { ...testImagePayload2, isPrimary: false }; // Explicitly not primary
      const res = await request(app)
        .post(`/api/v1/products/${testProductId}/images`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.data.isPrimary).toBe(false);
      anotherImageId = res.body.data.id;
    });

    it('should fail to add image to non-existent product', async () => {
      const res = await request(app)
        .post(`/api/v1/products/999999/images`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testImagePayload1);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /products/:productId/images', () => {
    it('should list all images for a product (as admin)', async () => {
      const res = await request(app)
        .get(`/api/v1/products/${testProductId}/images`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2); // At least the two created
      expect(res.body.data.some((img: any) => img.id === createdImageId)).toBe(true);
      expect(res.body.data.some((img: any) => img.id === anotherImageId)).toBe(true);
    });
  });

  describe('GET /products/:productId/images/:imageId', () => {
    it('should get a specific product image (as admin)', async () => {
      const res = await request(app)
        .get(`/api/v1/products/${testProductId}/images/${createdImageId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(createdImageId);
    });
    it('should return 404 for non-existent imageId (as admin)', async () => {
      const res = await request(app)
        .get(`/api/v1/products/${testProductId}/images/999999`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /products/:productId/images/:imageId', () => {
    it('should update image details (e.g., altText) (as admin)', async () => {
      const updatePayload = { altText: 'Texte alternatif mis à jour' };
      const res = await request(app)
        .put(`/api/v1/products/${testProductId}/images/${createdImageId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatePayload);
      expect(res.status).toBe(200);
      expect(res.body.data.altText).toBe(updatePayload.altText);
    });
  });

  describe('PATCH /products/:productId/images/:imageId/set-primary', () => {
    it('should set an image as primary (as admin)', async () => {
      // Ensure anotherImageId is not primary first
      await request(app)
        .put(`/api/v1/products/${testProductId}/images/${anotherImageId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isPrimary: false });

      const res = await request(app)
        .patch(`/api/v1/products/${testProductId}/images/${anotherImageId}/set-primary`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(anotherImageId);
      expect(res.body.data.isPrimary).toBe(true);

      // Verify old primary is no longer primary
      const oldPrimaryRes = await request(app)
        .get(`/api/v1/products/${testProductId}/images/${createdImageId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(oldPrimaryRes.body.data.isPrimary).toBe(false);
    });
  });

  describe('DELETE /products/:productId/images/:imageId', () => {
    it('should fail to delete a primary image (as admin)', async () => {
      await request(app)
        .patch(`/api/v1/products/${testProductId}/images/${anotherImageId}/set-primary`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .delete(`/api/v1/products/${testProductId}/images/${anotherImageId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });

    it('should delete a non-primary product image (as admin)', async () => {
      const res = await request(app)
        .delete(`/api/v1/products/${testProductId}/images/${createdImageId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);
    });
    it('should return 404 when trying to get a deleted image (as admin)', async () => {
      const res = await request(app)
        .get(`/api/v1/products/${testProductId}/images/${createdImageId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });
});

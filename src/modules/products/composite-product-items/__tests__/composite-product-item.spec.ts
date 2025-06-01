import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import app from '@/app';
import { adminToken } from '@/tests/globalSetup';

describe('Composite Product Items API', () => {
  let testCompositeProductId: number; // PROD-KIT-001 (ID 4)
  let testComponentProductId1: number; // PROD-MSE-001 (ID 5)
  let testComponentProductId2: number; // PROD-SP-001 (ID 1) - parent product of the variant
  let testComponentVariantId: number; // PROD-SP-001-BLU (ID 1)
  let testComponentProductId3: number; // PROD-ACC-001 (ID 3) - USB-C Charger
  let createdItemLinkId1: number;
  let createdItemLinkId2: number;

  beforeAll(async () => {
    testCompositeProductId = 4; // Essential Telework Kit
    testComponentProductId1 = 5; // Ergonomic Wireless Mouse
    testComponentProductId2 = 1; // Smartphone Model X (parent product of the variant)
    testComponentVariantId = 1; // Smartphone Model X - Blue
    testComponentProductId3 = 3; // USB-C Charger
  });

  describe('POST /products/:productId/components', () => {
    it('should add a component (base product) to a composite product (as admin)', async () => {
      const payload = { componentProductId: testComponentProductId3, quantity: 2 };
      const res = await request(app)
        .post(`/api/v1/products/${testCompositeProductId}/components`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id');
      createdItemLinkId1 = res.body.data.id;
      expect(res.body.data.compositeProductId).toBe(testCompositeProductId);
      expect(res.body.data.componentProductId).toBe(payload.componentProductId);
      expect(res.body.data.quantity).toBe(payload.quantity);
    });

    it('should add a component (product variant) to a composite product (as admin)', async () => {
      const payload = {
        componentProductId: testComponentProductId2, // Parent product of the variant
        componentVariantId: testComponentVariantId,
        quantity: 1,
      };
      const res = await request(app)
        .post(`/api/v1/products/${testCompositeProductId}/components`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id');
      createdItemLinkId2 = res.body.data.id;
      expect(res.body.data.componentVariantId).toBe(testComponentVariantId);
      expect(res.body.data.quantity).toBe(payload.quantity);
    });

    it('should fail if composite product is not marked as composite (as admin)', async () => {
      const payload = { componentProductId: testComponentProductId1, quantity: 1 };
      // Use a non-composite product ID (e.g., testComponentProductId1 itself)
      const res = await request(app)
        .post(`/api/v1/products/${testComponentProductId1}/components`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);
      expect(res.status).toBe(400);
      expect(res.body.data).toContain('is not a composite product');
    });

    it('should fail if component product does not exist (as admin)', async () => {
      const payload = { componentProductId: 999999, quantity: 1 };
      const res = await request(app)
        .post(`/api/v1/products/${testCompositeProductId}/components`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);
      expect(res.status).toBe(400); // Or 404 depending on how service handles it
    });
  });

  describe('GET /products/:productId/components', () => {
    it('should list all components for a composite product (as admin)', async () => {
      const res = await request(app)
        .get(`/api/v1/products/${testCompositeProductId}/components`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2); // The two added above
      expect(res.body.data.some((item: any) => item.id === createdItemLinkId1)).toBe(true);
      expect(res.body.data.some((item: any) => item.id === createdItemLinkId2)).toBe(true);
    });
  });

  describe('GET /products/:productId/components/:itemId', () => {
    it('should get a specific component link by its ID (as admin)', async () => {
      const res = await request(app)
        .get(`/api/v1/products/${testCompositeProductId}/components/${createdItemLinkId1}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(createdItemLinkId1);
      expect(res.body.data.componentProductId).toBe(testComponentProductId3);
    });
    it('should return 404 for non-existent item ID (as admin)', async () => {
      const res = await request(app)
        .get(`/api/v1/products/${testCompositeProductId}/components/999999`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /products/:productId/components/:itemId', () => {
    it('should update a component quantity (as admin)', async () => {
      const updatePayload = { quantity: 5 };
      const res = await request(app)
        .put(`/api/v1/products/${testCompositeProductId}/components/${createdItemLinkId1}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatePayload);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(createdItemLinkId1);
      expect(res.body.data.quantity).toBe(updatePayload.quantity);
    });
    it('should fail to update with zero or negative quantity (as admin)', async () => {
      const updatePayload = { quantity: 0 };
      const res = await request(app)
        .put(`/api/v1/products/${testCompositeProductId}/components/${createdItemLinkId1}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatePayload);
      expect(res.status).toBe(400);
      expect(res.body.data).toContain('Quantity must be positive');
    });
  });

  describe('DELETE /products/:productId/components/:itemId', () => {
    it('should remove a component from a composite product (as admin)', async () => {
      const res = await request(app)
        .delete(`/api/v1/products/${testCompositeProductId}/components/${createdItemLinkId1}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);

      // Verify it's gone
      const getRes = await request(app)
        .get(`/api/v1/products/${testCompositeProductId}/components/${createdItemLinkId1}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.status).toBe(404);
    });
  });
});

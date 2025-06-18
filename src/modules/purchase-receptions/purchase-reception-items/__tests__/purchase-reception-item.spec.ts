import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import app from '@/app';
import { adminToken } from '@/tests/globalSetup';

describe('Purchase Reception Items API (nested)', () => {
  let purchaseReceptionItemId: number;
  let testProductId1: number; // For PO Item 1 (Smartphone Modèle X)
  let testProductId2: number; // For PO Item 2 (Chargeur USB-C Rapide)
  let testPoItemId1: number; // PO Item 1 (Smartphone)
  let testPoItemId2: number; // PO Item 2 (Chargeur)

  let parentReceptionId: number; // REC-2025-00003 (status PENDING_QUALITY_CHECK)
  let initialReceptionItemId: number; // Item 3 (linked to REC-2025-00003)

  beforeAll(() => {
    // IDs from 2-datas.sql
    testProductId1 = 1; // Smartphone Modèle X
    testProductId2 = 3; // Chargeur USB-C Rapide
    testPoItemId1 = 2; // PO Item 2 (Chargeur USB-C Rapide)
    testPoItemId2 = 2; // PO Item 2 (Chargeur USB-C Rapide)

    parentReceptionId = 3; // REC-2025-00003 (status PENDING_QUALITY_CHECK)
    initialReceptionItemId = 3; // Item 3 (linked to REC-2025-00003)
  });

  describe('POST /purchase-receptions/:receptionId/items', () => {
    it('should add a new item to an existing purchase reception', async () => {
      const newItemPayload = {
        purchaseOrderItemId: testPoItemId1, // Link to PO Item 1 (Smartphone)
        productId: testProductId1,
        quantityReceived: 5,
        lotNumber: 'LOT-SPX-NEW-001',
        notes: 'New smartphone item received',
      };

      const res = await request(app)
        .post(`/api/v1/purchase-receptions/${parentReceptionId}/items`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newItemPayload);

      purchaseReceptionItemId = res.body.data.id;

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.purchaseReceptionId).toBe(parentReceptionId);
      expect(res.body.data.productId).toBe(newItemPayload.productId);
      expect(res.body.data.quantityReceived).toBe(newItemPayload.quantityReceived);
      expect(res.body.data.lotNumber).toBe(newItemPayload.lotNumber);
    });

    it('should fail to add item if reception status does not allow modification', async () => {
      const nonModifiableReceptionId = 1;
      const newItemPayload = {
        purchaseOrderItemId: testPoItemId2,
        productId: testProductId2,
        quantityReceived: 1,
      };

      const res = await request(app)
        .post(`/api/v1/purchase-receptions/${nonModifiableReceptionId}/items`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newItemPayload);
      expect(res.status).toBe(403);
    });

    it('should fail if product does not exist', async () => {
      const invalidItemPayload = {
        productId: 999999,
        quantityReceived: 1,
        notes: 'Invalid item',
      };
      const res = await request(app)
        .post(`/api/v1/purchase-receptions/${parentReceptionId}/items`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidItemPayload);
      expect(res.status).toBe(400);
    });

    it('should add item with zero quantity received', async () => {
      const zeroQuantityItemPayload = {
        productId: testProductId1,
        quantityReceived: 0,
        notes: 'Item received with zero quantity',
      };
      const res = await request(app)
        .post(`/api/v1/purchase-receptions/${parentReceptionId}/items`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(zeroQuantityItemPayload);
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.quantityReceived).toBe(0);
    });

    it('should fail to add item with negative quantity', async () => {
      const negativeQuantityItemPayload = {
        productId: testProductId1,
        quantityReceived: -1, // Invalid quantity
        notes: 'Negative quantity item',
      };
      const res = await request(app)
        .post(`/api/v1/purchase-receptions/${parentReceptionId}/items`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(negativeQuantityItemPayload);
      expect(res.status).toBe(400);
    });

    it('should fail to add duplicate item for the same PO line', async () => {
      const duplicateItemPayload = {
        purchaseOrderItemId: testPoItemId2,
        productId: testProductId2,
        quantityReceived: 1,
      };
      const res = await request(app)
        .post(`/api/v1/purchase-receptions/${parentReceptionId}/items`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(duplicateItemPayload);
      expect(res.status).toBe(400);
    });

    it('should fail if quantity received exceeds remaining PO item quantity', async () => {
      const excessiveQuantityPayload = {
        purchaseOrderItemId: testPoItemId2,
        productId: testProductId2,
        quantityReceived: 6,
      };
      const res = await request(app)
        .post(`/api/v1/purchase-receptions/${parentReceptionId}/items`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(excessiveQuantityPayload);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /purchase-receptions/:receptionId/items', () => {
    it('should list all items for a specific purchase reception', async () => {
      const res = await request(app)
        .get(`/api/v1/purchase-receptions/${parentReceptionId}/items`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      const items: { id: number }[] = res.body.data;
      expect(items.some((item) => item.id === initialReceptionItemId)).toBe(true);
    });

    it('should return 404 if reception does not exist', async () => {
      const res = await request(app)
        .get(`/api/v1/purchase-receptions/999999/items`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /purchase-receptions/:receptionId/items/:itemId', () => {
    it('should get a specific item from a purchase reception', async () => {
      const res = await request(app)
        .get(`/api/v1/purchase-receptions/${parentReceptionId}/items/${initialReceptionItemId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(initialReceptionItemId);
      expect(res.body.data.purchaseReceptionId).toBe(parentReceptionId);
      expect(res.body.data.productId).toBe(testProductId2);
    });

    it('should return 404 for non-existent itemId', async () => {
      const res = await request(app)
        .get(`/api/v1/purchase-receptions/${parentReceptionId}/items/999999`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('should return 404 if item does not belong to reception', async () => {
      const itemFromOtherReception = 2;
      const res = await request(app)
        .get(`/api/v1/purchase-receptions/${parentReceptionId}/items/${itemFromOtherReception}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /purchase-receptions/:receptionId/items/:itemId', () => {
    it('should update a specific item in a purchase reception', async () => {
      const updatePayload = { quantityReceived: 7, notes: 'Updated quantity received for item' };
      const res = await request(app)
        .put(`/api/v1/purchase-receptions/${parentReceptionId}/items/${initialReceptionItemId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatePayload);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.id).toBe(initialReceptionItemId);
      expect(res.body.data.quantityReceived).toBe(updatePayload.quantityReceived);
      expect(res.body.data.notes).toBe(updatePayload.notes);
    });

    it('should fail to update item if reception status does not allow modification', async () => {
      const nonModifiableReceptionId = 1;
      const itemInNonModifiableReception = 1;
      const updatePayload = { quantityReceived: 26 };

      const res = await request(app)
        .put(
          `/api/v1/purchase-receptions/${nonModifiableReceptionId}/items/${itemInNonModifiableReception}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatePayload);
      expect(res.status).toBe(403); // Forbidden
    });

    it('should fail to update item with negative quantity', async () => {
      const negativeQuantityPayload = { quantityReceived: -5 };
      const res = await request(app)
        .put(`/api/v1/purchase-receptions/${parentReceptionId}/items/${initialReceptionItemId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(negativeQuantityPayload);
      expect(res.status).toBe(400);
    });

    it('should fail if updated quantity exceeds remaining PO item quantity', async () => {
      const excessiveQuantityPayload = { quantityReceived: 11 };
      const res = await request(app)
        .put(`/api/v1/purchase-receptions/${parentReceptionId}/items/${initialReceptionItemId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(excessiveQuantityPayload);
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /purchase-receptions/:receptionId/items/:itemId', () => {
    it('should remove an item from a purchase reception', async () => {
      const res = await request(app)
        .delete(`/api/v1/purchase-receptions/${parentReceptionId}/items/${purchaseReceptionItemId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);

      // Verify it's gone
      const getRes = await request(app)
        .get(`/api/v1/purchase-receptions/${parentReceptionId}/items/${purchaseReceptionItemId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.status).toBe(404);
    });

    it('should fail to remove item if reception status does not allow modification', async () => {
      const nonModifiableReceptionId = 1;
      const itemInNonModifiableReception = 1;

      const res = await request(app)
        .delete(
          `/api/v1/purchase-receptions/${nonModifiableReceptionId}/items/${itemInNonModifiableReception}`,
        )
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 404 for non-existent itemId on delete', async () => {
      const res = await request(app)
        .delete(`/api/v1/purchase-receptions/${parentReceptionId}/items/999999`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });
});

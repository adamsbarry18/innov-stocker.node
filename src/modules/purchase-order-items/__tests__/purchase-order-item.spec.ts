import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import app from '@/app';
import { adminToken } from '@/tests/globalSetup';
import { PurchaseOrderStatus } from '@/modules/purchase-orders/models/purchase-order.entity';

describe('Purchase Order Items API (nested under Purchase Orders)', () => {
  let testProductId1: number = 1; // From 2-datas.sql
  let testProductId2: number = 2; // From 2-datas.sql
  let testPurchaseOrderId: number;
  let createdPoItemId1: number;
  let createdPoItemId2: number;

  const poItemPayloadToAdd = {
    productId: testProductId2, // Use a valid product ID
    quantity: 3,
    unitPriceHt: 75.0,
    description: 'Item ajouté séparément',
    vatRatePercentage: 10.0,
  };

  beforeAll(async () => {
    // Create a new Purchase Order for testing
    const poRes = await request(app)
      .post('/api/v1/purchase-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId: 1, // Assuming supplier with ID 1 exists
        orderDate: '2025-05-22',
        expectedDeliveryDate: '2025-05-30',
        status: PurchaseOrderStatus.DRAFT,
        currencyId: 1, // Assuming currency with ID 1 (EUR) exists
        shippingAddressId: 7, // Assuming address with ID 7 exists
        warehouseIdForDelivery: 1, // Assuming warehouse with ID 1 exists
        notes: 'Test Purchase Order for items API',
        items: [], // Add empty items array to satisfy CreatePurchaseOrderInput
      });

    expect(poRes.status).toBe(201);
    expect(poRes.body.status).toBe('success');
    expect(poRes.body.data).toHaveProperty('id');
    testPurchaseOrderId = poRes.body.data.id;

    // Add initial item to the created PO
    const item1Res = await request(app)
      .post(`/api/v1/purchase-orders/${testPurchaseOrderId}/items`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productId: testProductId1,
        quantity: 5,
        unitPriceHt: 100.0,
        description: 'Initial test item',
        vatRatePercentage: 20.0,
      });

    expect(item1Res.status).toBe(201);
    expect(item1Res.body.status).toBe('success');
    expect(item1Res.body.data).toHaveProperty('id');
    createdPoItemId1 = item1Res.body.data.id;
  });

  describe('POST /purchase-orders/:orderId/items', () => {
    it('should add a new item to an existing purchase order (as user with rights)', async () => {
      const res = await request(app)
        .post(`/api/v1/purchase-orders/${testPurchaseOrderId}/items`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(poItemPayloadToAdd);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id');
      createdPoItemId2 = res.body.data.id;
      expect(res.body.data.purchaseOrderId).toBe(testPurchaseOrderId);
      expect(res.body.data.productId).toBe(testProductId2);
      expect(res.body.data.quantity).toBe(poItemPayloadToAdd.quantity);
    });

    it('should fail to add item if PO is not in DRAFT or PENDING_APPROVAL status', async () => {
      // Change PO status to APPROVED
      await request(app)
        .patch(`/api/v1/purchase-orders/${testPurchaseOrderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: PurchaseOrderStatus.APPROVED, approvedByUserId: 1 });

      const res = await request(app)
        .post(`/api/v1/purchase-orders/${testPurchaseOrderId}/items`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(poItemPayloadToAdd);
      expect(res.status).toBe(403); // Forbidden

      // Revert for other tests
      await request(app)
        .patch(`/api/v1/purchase-orders/${testPurchaseOrderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: PurchaseOrderStatus.DRAFT });
    });
  });

  describe('GET /purchase-orders/:orderId/items', () => {
    it('should list all items for a specific purchase order', async () => {
      const res = await request(app)
        .get(`/api/v1/purchase-orders/${testPurchaseOrderId}/items`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2); // Item1 + Item2
      expect(res.body.data.some((item: any) => item.id === createdPoItemId1)).toBe(true);
      expect(res.body.data.some((item: any) => item.id === createdPoItemId2)).toBe(true);
    });
  });

  describe('GET /purchase-orders/:orderId/items/:itemId', () => {
    it('should get a specific item from a purchase order', async () => {
      const res = await request(app)
        .get(`/api/v1/purchase-orders/${testPurchaseOrderId}/items/${createdPoItemId1}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(createdPoItemId1);
      expect(res.body.data.productId).toBe(testProductId1);
    });
    it('should return 404 for non-existent itemId on the PO', async () => {
      const res = await request(app)
        .get(`/api/v1/purchase-orders/${testPurchaseOrderId}/items/999999`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /purchase-orders/:orderId/items/:itemId', () => {
    const updateItemPayload = {
      quantity: 7,
      unitPriceHt: 45.0,
      description: 'Item initial PO - MàJ',
    };
    it('should update a specific item in a purchase order', async () => {
      const res = await request(app)
        .put(`/api/v1/purchase-orders/${testPurchaseOrderId}/items/${createdPoItemId1}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateItemPayload);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.id).toBe(createdPoItemId1);
      expect(res.body.data.quantity).toBe(updateItemPayload.quantity);
      expect(res.body.data.unitPriceHt).toBe(updateItemPayload.unitPriceHt);
      expect(res.body.data.description).toBe(updateItemPayload.description);
    });
  });

  describe('DELETE /purchase-orders/:orderId/items/:itemId', () => {
    it('should remove an item from a purchase order', async () => {
      const res = await request(app)
        .delete(`/api/v1/purchase-orders/${testPurchaseOrderId}/items/${createdPoItemId1}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);

      // Verify it's gone
      const getRes = await request(app)
        .get(`/api/v1/purchase-orders/${testPurchaseOrderId}/items/${createdPoItemId1}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.status).toBe(404);
    });
  });
});

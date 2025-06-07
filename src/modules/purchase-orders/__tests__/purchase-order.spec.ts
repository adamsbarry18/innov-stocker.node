import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import app from '@/app';
import { adminToken } from '@/tests/globalSetup';
import dayjs from 'dayjs';
import { PurchaseOrderStatus } from '../models/purchase-order.entity';

describe('Purchase Orders API', () => {
  let testSupplierId: number;
  let testCurrencyId: number;
  let testDeliveryAddressId: number;
  let testProductId1: number;
  let createdPurchaseOrderId: number;
  let createdPoItemId: number;

  const poItemPayload1 = {
    productId: 1, // Assuming a default product ID for testing
    quantity: 5,
    unitPriceHt: 200.0,
    vatRatePercentage: 20.0,
    description: 'Item PO Test 1',
  };

  beforeAll(() => {
    // Assuming these IDs exist in the seeded test database (2-datas.sql)
    testSupplierId = 1;
    testCurrencyId = 1;
    testDeliveryAddressId = 4;
    testProductId1 = 1;
  });

  const basePurchaseOrderPayload = {
    supplierId: 0,
    orderDate: dayjs().format('YYYY-MM-DD'),
    currencyId: 0,
    warehouseIdForDelivery: 1, // Use a valid warehouse ID
    shippingAddressId: 7, // Use a valid shipping address ID
    items: [], // Remove initial items for testing
  };

  describe('POST /purchase-orders', () => {
    it('should create a new purchase order with items (as user with rights)', async () => {
      const payload = {
        ...basePurchaseOrderPayload,
        supplierId: testSupplierId,
        currencyId: testCurrencyId,
        shippingAddressId: testDeliveryAddressId,
        items: [poItemPayload1], // Re-add items for this specific test
      };
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id');
      createdPurchaseOrderId = res.body.data.id;
      expect(res.body.data.supplierId).toBe(testSupplierId);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].productId).toBe(testProductId1);
      createdPoItemId = res.body.data.items[0].id;
      expect(res.body.data.totalAmountHt).toBeCloseTo(1000.0); // 5 * 200
    });

    it('should fail to create PO if supplier does not exist', async () => {
      const payload = {
        ...basePurchaseOrderPayload,
        supplierId: 99999,
        currencyId: testCurrencyId,
        shippingAddressId: testDeliveryAddressId,
      };
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /purchase-orders', () => {
    it('should return a list of purchase orders', async () => {
      const res = await request(app)
        .get('/api/v1/purchase-orders?limit=5')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('orders');
      expect(Array.isArray(res.body.data.orders)).toBe(true);
    });
  });

  describe('GET /purchase-orders/:id', () => {
    it('should return a specific purchase order by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/purchase-orders/${createdPurchaseOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(createdPurchaseOrderId);
      expect(res.body.data.items).toHaveLength(1);
    });
  });

  describe('PUT /purchase-orders/:id', () => {
    it('should update an existing purchase order (e.g., notes and add an item)', async () => {
      const newItemPayload = {
        productId: testProductId1,
        quantity: 3,
        unitPriceHt: 190.0,
        description: 'Item ajouté en MàJ',
      };
      const updatePayload = {
        notes: 'Commande mise à jour avec un item supplémentaire.',
        warehouseIdForDelivery: basePurchaseOrderPayload.warehouseIdForDelivery, // Add delivery destination
        items: [
          { id: createdPoItemId, quantity: 4, unitPriceHt: 210.0 }, // Update existing
          newItemPayload, // Add new
        ],
      };
      const res = await request(app)
        .put(`/api/v1/purchase-orders/${createdPurchaseOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatePayload);
      expect(res.status).toBe(200);
      expect(res.body.data.notes).toBe(updatePayload.notes);
      expect(res.body.data.items).toHaveLength(2);
      const updatedItem = res.body.data.items.find((item: any) => item.id === createdPoItemId);
      expect(updatedItem.quantity).toBe(4);
      expect(updatedItem.unitPriceHt).toBe(210.0);
      expect(res.body.data.totalAmountHt).toBeCloseTo(4 * 210 + 3 * 190); // 840 + 570 = 1410
    });
  });

  describe('PATCH /purchase-orders/:id/status', () => {
    it('should update purchase order status to APPROVED', async () => {
      const res = await request(app)
        .patch(`/api/v1/purchase-orders/${createdPurchaseOrderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`) // Assuming admin can approve
        .send({ status: PurchaseOrderStatus.APPROVED, approvedByUserId: 1 }); // admin user id 1

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(PurchaseOrderStatus.APPROVED);
      expect(res.body.data.approvedByUserId).toBe(1);
    });
  });

  describe('DELETE /purchase-orders/:id', () => {
    let poToDeleteId: number;
    beforeAll(async () => {
      const payload = {
        ...basePurchaseOrderPayload,
        supplierId: testSupplierId,
        currencyId: testCurrencyId,
        shippingAddressId: testDeliveryAddressId,
        status: PurchaseOrderStatus.DRAFT,
        orderNumber: `PO-DEL-${Date.now()}`,
      };
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);
      poToDeleteId = res.body.data.id;
    });

    it('should soft delete a purchase order (if in DRAFT status)', async () => {
      const res = await request(app)
        .delete(`/api/v1/purchase-orders/${poToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);
    });
  });
});

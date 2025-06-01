import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

import app from '@/app';
import { adminToken } from '@/tests/globalSetup';
import { SalesOrderStatus } from '../../models/sales-order.entity';

const generateUniqueOrderNumber = () =>
  `SO-${dayjs().format('YYYYMMDDHHmmss')}-${uuidv4().substring(0, 8)}`;

const testSalesOrderInput = () => ({
  customerId: 1,
  orderNumber: generateUniqueOrderNumber(),
  orderDate: new Date().toISOString(),
  status: SalesOrderStatus.DRAFT,
  currencyId: 1,
  shippingFeesHt: 0,
  shippingAddressId: 5,
  billingAddressId: 4,
  dispatchWarehouseId: 1,
  notes: 'Test sales order for items management',
  items: [], // Start with no items
});

const testSalesOrderItemInput = (productId: number = 1) => ({
  productId: productId,
  quantity: 1,
  unitPriceHt: 100.0,
  vatRatePercentage: 20,
  discountPercentage: 0,
  description: 'Test Sales Order Item',
});

// Helper to create a new sales order in DRAFT status for tests that require it
const createDraftSalesOrder = async () => {
  const res = await request(app)
    .post('/api/v1/sales-orders')
    .set('Authorization', `Bearer ${adminToken}`)
    .send(testSalesOrderInput());
  expect(res.status).toBe(201);
  return res.body.data.id;
};

describe('SalesOrderItems API', () => {
  let salesOrderId: number;
  let createdSalesOrderItemId: number;

  beforeAll(async () => {
    // Create a sales order to associate items with
    const res = await request(app)
      .post('/api/v1/sales-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(testSalesOrderInput());
    expect(res.status).toBe(201);
    salesOrderId = res.body.data.id;

    // Add an initial item to be used in tests
    const itemRes = await request(app)
      .post(`/api/v1/sales-orders/${salesOrderId}/items`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(testSalesOrderItemInput());
    expect(itemRes.status).toBe(201);
    createdSalesOrderItemId = itemRes.body.data.id;
  });

  afterAll(async () => {
    // Clean up: delete the sales order and its items
    if (salesOrderId) {
      const currentOrderRes = await request(app)
        .get(`/api/v1/sales-orders/${salesOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      if (
        currentOrderRes.body.data.status !== SalesOrderStatus.DRAFT &&
        currentOrderRes.body.data.status !== SalesOrderStatus.CANCELLED
      ) {
        await request(app)
          .patch(`/api/v1/sales-orders/${salesOrderId}/cancel`)
          .set('Authorization', `Bearer ${adminToken}`);
      }
      await request(app)
        .delete(`/api/v1/sales-orders/${salesOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
  });

  describe('POST /sales-orders/:salesOrderId/items', () => {
    let currentSalesOrderId: number;
    beforeEach(async () => {
      currentSalesOrderId = await createDraftSalesOrder();
    });
    afterEach(async () => {
      if (currentSalesOrderId) {
        await request(app)
          .delete(`/api/v1/sales-orders/${currentSalesOrderId}`)
          .set('Authorization', `Bearer ${adminToken}`);
      }
    });

    it('should add a new item to a sales order', async () => {
      const newItem = testSalesOrderItemInput(2); // Use a different product for uniqueness
      const res = await request(app)
        .post(`/api/v1/sales-orders/${currentSalesOrderId}/items`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newItem);

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.salesOrderId).toBe(currentSalesOrderId);
      expect(res.body.data.productId).toBe(newItem.productId);
      expect(res.body.data.quantity).toBe(newItem.quantity);

      // Clean up the created item
      await request(app)
        .delete(`/api/v1/sales-orders/${currentSalesOrderId}/items/${res.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
    });

    it('should fail to add an item to a non-existent sales order', async () => {
      const res = await request(app)
        .post('/api/v1/sales-orders/999999/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testSalesOrderItemInput());
      expect(res.status).toBe(404);
    });

    it('should fail to add an item to a sales order if status is not DRAFT', async () => {
      // Approve the sales order first
      await request(app)
        .patch(`/api/v1/sales-orders/${currentSalesOrderId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .post(`/api/v1/sales-orders/${currentSalesOrderId}/items`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testSalesOrderItemInput(3));

      expect(res.status).toBe(403);
    });

    it('should fail to add an item without authentication', async () => {
      const res = await request(app)
        .post(`/api/v1/sales-orders/${currentSalesOrderId}/items`)
        .send(testSalesOrderItemInput());
      expect(res.status).toBe(401);
    });
  });

  describe('GET /sales-orders/:salesOrderId/items', () => {
    it('should return a list of items for a sales order', async () => {
      const res = await request(app)
        .get(`/api/v1/sales-orders/${salesOrderId}/items`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data.items.length).toBeGreaterThan(0);
      expect(res.body.data.items[0]).toHaveProperty('id');
      expect(res.body.data.items[0].salesOrderId).toBe(salesOrderId);
    });

    it('should return 404 for a non-existent sales order', async () => {
      const res = await request(app)
        .get('/api/v1/sales-orders/999999/items')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('should fail to get items without authentication', async () => {
      const res = await request(app).get(`/api/v1/sales-orders/${salesOrderId}/items`);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /sales-orders/:salesOrderId/items/:itemId', () => {
    it('should return a specific item by ID for a sales order', async () => {
      const res = await request(app)
        .get(`/api/v1/sales-orders/${salesOrderId}/items/${createdSalesOrderItemId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id', createdSalesOrderItemId);
      expect(res.body.data.salesOrderId).toBe(salesOrderId);
    });

    it('should return 404 for a non-existent item', async () => {
      const res = await request(app)
        .get(`/api/v1/sales-orders/${salesOrderId}/items/999999`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('should return 404 for an item not belonging to the specified sales order', async () => {
      // Create another sales order and an item in it
      const anotherOrderRes = await request(app)
        .post('/api/v1/sales-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testSalesOrderInput());
      const anotherOrderId = anotherOrderRes.body.data.id;

      const anotherItemRes = await request(app)
        .post(`/api/v1/sales-orders/${anotherOrderId}/items`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testSalesOrderItemInput(4));
      const anotherItemId = anotherItemRes.body.data.id;

      const res = await request(app)
        .get(`/api/v1/sales-orders/${salesOrderId}/items/${anotherItemId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);

      // Clean up
      await request(app)
        .delete(`/api/v1/sales-orders/${anotherOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    });

    it('should fail to get a specific item without authentication', async () => {
      const res = await request(app).get(
        `/api/v1/sales-orders/${salesOrderId}/items/${createdSalesOrderItemId}`,
      );
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /sales-orders/:salesOrderId/items/:itemId', () => {
    const updateData = {
      quantity: 5,
      unitPriceHt: 120.0,
      description: 'Updated Test Sales Order Item',
    };
    let currentSalesOrderId: number;
    let currentSalesOrderItemId: number;

    beforeEach(async () => {
      currentSalesOrderId = await createDraftSalesOrder();
      const itemRes = await request(app)
        .post(`/api/v1/sales-orders/${currentSalesOrderId}/items`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testSalesOrderItemInput());
      expect(itemRes.status).toBe(201);
      currentSalesOrderItemId = itemRes.body.data.id;
    });

    afterEach(async () => {
      if (currentSalesOrderId) {
        await request(app)
          .delete(`/api/v1/sales-orders/${currentSalesOrderId}`)
          .set('Authorization', `Bearer ${adminToken}`);
      }
    });

    it('should update an existing item in a sales order', async () => {
      const res = await request(app)
        .put(`/api/v1/sales-orders/${currentSalesOrderId}/items/${currentSalesOrderItemId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id', currentSalesOrderItemId);
      expect(res.body.data.quantity).toBe(updateData.quantity);
      expect(res.body.data.unitPriceHt).toBe(updateData.unitPriceHt);
      expect(res.body.data.description).toBe(updateData.description);
    });

    it('should fail to update an item in a non-existent sales order', async () => {
      const res = await request(app)
        .put(`/api/v1/sales-orders/999999/items/${currentSalesOrderItemId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);
      expect(res.status).toBe(404);
    });

    it('should fail to update a non-existent item in an existing sales order', async () => {
      const res = await request(app)
        .put(`/api/v1/sales-orders/${currentSalesOrderId}/items/999999`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);
      expect(res.status).toBe(404);
    });

    it('should fail to update an item if sales order status is not DRAFT', async () => {
      await request(app)
        .patch(`/api/v1/sales-orders/${currentSalesOrderId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .put(`/api/v1/sales-orders/${currentSalesOrderId}/items/${currentSalesOrderItemId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantity: 10 });

      expect(res.status).toBe(403);
    });

    it('should fail to update an item without authentication', async () => {
      const res = await request(app)
        .put(`/api/v1/sales-orders/${currentSalesOrderId}/items/${currentSalesOrderItemId}`)
        .send(updateData);
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /sales-orders/:salesOrderId/items/:itemId', () => {
    let currentSalesOrderId: number;
    let itemToDeleteId: number;

    beforeEach(async () => {
      currentSalesOrderId = await createDraftSalesOrder();
      const res = await request(app)
        .post(`/api/v1/sales-orders/${currentSalesOrderId}/items`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testSalesOrderItemInput(5));
      expect(res.status).toBe(201);
      itemToDeleteId = res.body.data.id;
    });

    afterEach(async () => {
      if (currentSalesOrderId) {
        await request(app)
          .delete(`/api/v1/sales-orders/${currentSalesOrderId}`)
          .set('Authorization', `Bearer ${adminToken}`);
      }
    });

    it('should delete an item from a sales order', async () => {
      const res = await request(app)
        .delete(`/api/v1/sales-orders/${currentSalesOrderId}/items/${itemToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);

      const getRes = await request(app)
        .get(`/api/v1/sales-orders/${currentSalesOrderId}/items/${itemToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.status).toBe(404);
    });

    it('should fail to delete an item from a non-existent sales order', async () => {
      const res = await request(app)
        .delete(`/api/v1/sales-orders/999999/items/${itemToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('should fail to delete a non-existent item from an existing sales order', async () => {
      const res = await request(app)
        .delete(`/api/v1/sales-orders/${currentSalesOrderId}/items/999999`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('should fail to delete an item if sales order status is not DRAFT', async () => {
      const itemRes = await request(app)
        .post(`/api/v1/sales-orders/${currentSalesOrderId}/items`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testSalesOrderItemInput(6));
      const approvedItemToDeleteId = itemRes.body.data.id;

      await request(app)
        .patch(`/api/v1/sales-orders/${currentSalesOrderId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .delete(`/api/v1/sales-orders/${currentSalesOrderId}/items/${approvedItemToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });

    it('should fail to delete an item without authentication', async () => {
      const res = await request(app).delete(
        `/api/v1/sales-orders/${currentSalesOrderId}/items/${itemToDeleteId}`,
      );
      expect(res.status).toBe(401);
    });
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';

import app from '@/app';
import { adminToken } from '@/tests/globalSetup';
import { SalesOrderStatus } from '../models/sales-order.entity';
import dayjs from 'dayjs';

describe('SalesOrders API', () => {
  // From 2-datas.sql: customerId 1, currencyId 1, addressId 4/5, warehouseId 1
  const generateUniqueOrderNumber = () =>
    `SO-${dayjs().format('YYYYMMDD')}-${uuidv4().substring(0, 8)}`;

  const testOrderInputWithItems = () => ({
    customerId: 1,
    orderNumber: generateUniqueOrderNumber(),
    orderDate: new Date().toISOString(),
    status: SalesOrderStatus.DRAFT,
    currencyId: 1,
    shippingFeesHt: 10,
    shippingAddressId: 5,
    billingAddressId: 4,
    dispatchWarehouseId: 1,
    notes: 'Test sales order with items',
    items: [
      {
        productId: 1,
        quantity: 2,
        unitPriceHt: 499.99,
        vatRatePercentage: 20,
        discountPercentage: 0,
        description: 'Test item',
      },
    ],
  });

  const testOrderInputWithoutItems = () => ({
    customerId: 1,
    orderNumber: generateUniqueOrderNumber(),
    orderDate: new Date().toISOString(),
    status: SalesOrderStatus.DRAFT,
    currencyId: 1,
    shippingFeesHt: 0,
    shippingAddressId: 5,
    billingAddressId: 4,
    dispatchWarehouseId: 1,
    notes: 'Test sales order without items (draft)',
    items: [],
  });

  let createdOrderId: number;
  let createdOrderWithoutItemsId: number;

  beforeAll(async () => {
    const resWithItems = await request(app)
      .post('/api/v1/sales-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(testOrderInputWithItems());
    expect(resWithItems.status).toBe(201);
    createdOrderId = resWithItems.body.data.id;

    const resWithoutItems = await request(app)
      .post('/api/v1/sales-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(testOrderInputWithoutItems());
    expect(resWithoutItems.status).toBe(201);
    createdOrderWithoutItemsId = resWithoutItems.body.data.id;
  });

  afterAll(async () => {
    if (createdOrderId) {
      const currentOrderRes = await request(app)
        .get(`/api/v1/sales-orders/${createdOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      if (
        currentOrderRes.body.data.status !== SalesOrderStatus.DRAFT &&
        currentOrderRes.body.data.status !== SalesOrderStatus.CANCELLED
      ) {
        await request(app)
          .patch(`/api/v1/sales-orders/${createdOrderId}/cancel`)
          .set('Authorization', `Bearer ${adminToken}`);
      }
      await request(app)
        .delete(`/api/v1/sales-orders/${createdOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
    if (createdOrderWithoutItemsId) {
      const currentOrderRes = await request(app)
        .get(`/api/v1/sales-orders/${createdOrderWithoutItemsId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      if (
        currentOrderRes.body.data.status !== SalesOrderStatus.DRAFT &&
        currentOrderRes.body.data.status !== SalesOrderStatus.CANCELLED
      ) {
        await request(app)
          .patch(`/api/v1/sales-orders/${createdOrderWithoutItemsId}/cancel`)
          .set('Authorization', `Bearer ${adminToken}`);
      }
      await request(app)
        .delete(`/api/v1/sales-orders/${createdOrderWithoutItemsId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
  });

  describe('POST /sales-orders', () => {
    it('should create a new sales order with items', async () => {
      const res = await request(app)
        .post('/api/v1/sales-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...testOrderInputWithItems(), notes: 'Another order with items' }); // Use a unique note
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.customerId).toBe(testOrderInputWithItems().customerId);
      expect(res.body.data.status).toBe(SalesOrderStatus.DRAFT);
      expect(res.body.data.items.length).toBe(1);
      await request(app)
        .delete(`/api/v1/sales-orders/${res.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
    });

    it('should create a new sales order without items if status is DRAFT', async () => {
      const res = await request(app)
        .post('/api/v1/sales-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...testOrderInputWithoutItems(), notes: 'Another order without items' });
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.status).toBe(SalesOrderStatus.DRAFT);
      expect(res.body.data.items.length).toBe(0);
      await request(app)
        .delete(`/api/v1/sales-orders/${res.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
    });

    it('should fail to create a sales order without items if status is not DRAFT', async () => {
      const res = await request(app)
        .post('/api/v1/sales-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...testOrderInputWithoutItems(), status: SalesOrderStatus.APPROVED });
      expect(res.status).toBe(400);
    });

    it('should fail to create a sales order without required fields (other than items)', async () => {
      const res = await request(app)
        .post('/api/v1/sales-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Missing required fields' });
      expect(res.status).toBe(400);
    });

    it('should fail to create a sales order without authentication', async () => {
      const res = await request(app).post('/api/v1/sales-orders').send(testOrderInputWithItems());
      expect(res.status).toBe(401);
    });
  });

  describe('GET /sales-orders', () => {
    it('should return a paginated list of sales orders', async () => {
      const res = await request(app)
        .get('/api/v1/sales-orders')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('orders');
      expect(res.body.data).toHaveProperty('total');
    });

    it('should fail to update an existing sales order by removing all items if status is not DRAFT', async () => {
      await request(app)
        .patch(`/api/v1/sales-orders/${createdOrderId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .put(`/api/v1/sales-orders/${createdOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ items: [] });

      expect(res.status).toBe(400);
    });

    it('should return a sales order by id (without items initially)', async () => {
      const res = await request(app)
        .get(`/api/v1/sales-orders/${createdOrderWithoutItemsId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id', createdOrderWithoutItemsId);
      expect(res.body.data.items.length).toBe(0);
    });

    it('should return 404 for non-existent sales order', async () => {
      const res = await request(app)
        .get('/api/v1/sales-orders/999999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id', async () => {
      const res = await request(app)
        .get('/api/v1/sales-orders/abc')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('should fail to get a sales order without authentication', async () => {
      const res = await request(app).get(`/api/v1/sales-orders/${createdOrderId}`);
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /sales-orders/:id', () => {
    const updateData = {
      notes: 'Updated sales order note',
    };

    it('should update an existing sales order (header fields)', async () => {
      const res = await request(app)
        .put(`/api/v1/sales-orders/${createdOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id', createdOrderId);
      expect(res.body.data.notes).toBe(updateData.notes);
    });

    it('should update an existing sales order by removing all items if status is DRAFT', async () => {
      const res = await request(app)
        .put(`/api/v1/sales-orders/${createdOrderWithoutItemsId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ items: [] });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id', createdOrderWithoutItemsId);
      expect(res.body.data.items.length).toBe(0);
    });

    it('should fail to update an existing sales order by removing all items if status is not DRAFT', async () => {
      await request(app)
        .patch(`/api/v1/sales-orders/${createdOrderId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .put(`/api/v1/sales-orders/${createdOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ items: [] });

      expect(res.status).toBe(400);
    });

    it('should return 404 for updating a non-existent sales order', async () => {
      const res = await request(app)
        .put('/api/v1/sales-orders/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id', async () => {
      const res = await request(app)
        .put('/api/v1/sales-orders/abc')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(res.status).toBe(400);
    });

    it('should fail to update a sales order without authentication', async () => {
      const res = await request(app).put(`/api/v1/sales-orders/${createdOrderId}`).send(updateData);
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /sales-orders/:id/approve', () => {
    let orderToApproveId: number;
    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/sales-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...testOrderInputWithItems(),
          notes: 'Order to approve',
          orderDate: '2025-06-07T10:00:00.000Z',
        });
      orderToApproveId = res.body.data.id;
    });

    afterAll(async () => {
      if (orderToApproveId) {
        const currentOrderRes = await request(app)
          .get(`/api/v1/sales-orders/${orderToApproveId}`)
          .set('Authorization', `Bearer ${adminToken}`);
        if (
          currentOrderRes.body.data.status !== SalesOrderStatus.DRAFT &&
          currentOrderRes.body.data.status !== SalesOrderStatus.CANCELLED
        ) {
          await request(app)
            .patch(`/api/v1/sales-orders/${orderToApproveId}/cancel`)
            .set('Authorization', `Bearer ${adminToken}`);
        }
        await request(app)
          .delete(`/api/v1/sales-orders/${orderToApproveId}`)
          .set('Authorization', `Bearer ${adminToken}`);
      }
    });

    it('should approve a sales order', async () => {
      const res = await request(app)
        .patch(`/api/v1/sales-orders/${orderToApproveId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('approved');
    });

    it('should return 404 for non-existent sales order', async () => {
      const res = await request(app)
        .patch('/api/v1/sales-orders/999999/approve')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id', async () => {
      const res = await request(app)
        .patch('/api/v1/sales-orders/abc/approve')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /sales-orders/:id/cancel', () => {
    let orderToCancelId: number;
    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/sales-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...testOrderInputWithItems(),
          notes: 'Order to cancel',
          orderDate: '2025-06-08T10:00:00.000Z',
        });
      orderToCancelId = res.body.data.id;
    });

    afterAll(async () => {
      if (orderToCancelId) {
        const currentOrderRes = await request(app)
          .get(`/api/v1/sales-orders/${orderToCancelId}`)
          .set('Authorization', `Bearer ${adminToken}`);
        if (
          currentOrderRes.body.data.status !== SalesOrderStatus.DRAFT &&
          currentOrderRes.body.data.status !== SalesOrderStatus.CANCELLED
        ) {
          await request(app)
            .patch(`/api/v1/sales-orders/${orderToCancelId}/cancel`)
            .set('Authorization', `Bearer ${adminToken}`);
        }
        await request(app)
          .delete(`/api/v1/sales-orders/${orderToCancelId}`)
          .set('Authorization', `Bearer ${adminToken}`);
      }
    });

    it('should cancel a sales order', async () => {
      const res = await request(app)
        .patch(`/api/v1/sales-orders/${orderToCancelId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('cancelled');
    });

    it('should return 404 for non-existent sales order', async () => {
      const res = await request(app)
        .patch('/api/v1/sales-orders/999999/cancel')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id', async () => {
      const res = await request(app)
        .patch('/api/v1/sales-orders/abc/cancel')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /sales-orders/:id', () => {
    let orderToDeleteId: number;
    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/sales-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...testOrderInputWithItems(),
          notes: 'Order to delete',
          orderDate: '2025-06-09T10:00:00.000Z',
        });
      orderToDeleteId = res.body.data.id;
    });

    it('should soft delete a sales order', async () => {
      const res = await request(app)
        .delete(`/api/v1/sales-orders/${orderToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
    });

    it('should return 404 for deleting a non-existent sales order', async () => {
      const res = await request(app)
        .delete('/api/v1/sales-orders/999999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id', async () => {
      const res = await request(app)
        .delete('/api/v1/sales-orders/abc')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('should fail to delete a sales order without authentication', async () => {
      const res = await request(app).delete(`/api/v1/sales-orders/${orderToDeleteId}`);
      expect(res.status).toBe(401);
    });
  });
});

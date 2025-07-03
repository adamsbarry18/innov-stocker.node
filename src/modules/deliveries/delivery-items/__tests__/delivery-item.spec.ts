import { describe, it, expect } from 'vitest';
import request from 'supertest';

import app from '@/app';
import { adminToken } from '@/tests/globalSetup';

const testDeliveryItemInput = (
  productId: number = 1,
  quantityOrdered: number = 5,
  quantityShipped: number = 1,
  salesOrderItemId?: number,
) => ({
  productId: productId,
  quantityOrdered: quantityOrdered,
  quantityShipped: quantityShipped,
  unitPriceHt: 100.0,
  vatRatePercentage: 20,
  discountPercentage: 0,
  description: 'Test Delivery Item',
  salesOrderItemId: salesOrderItemId,
});

describe('DeliveryItems API', () => {
  // IDs des données pré-existantes dans 2-datas.sql
  const existingDeliveryIdPending = 3; // DL-2025-00003
  const existingDeliveryIdShipped = 4; // DL-2025-00004
  const existingDeliveryItem1Id = 4; // Item 4 de DL-2025-00003 (Smartphone)
  const existingDeliveryItem2Id = 5; // Item 5 de DL-2025-00003 (Chargeur)
  const existingDeliveryItemShippedId = 6; // Item 6 de DL-2025-00004 (Smartphone)
  const newSalesOrderItemId = 10; // Nouvel item ajouté dans 2-datas.sql pour SO-2025-00004

  describe('POST /deliveries/:deliveryId/items', () => {
    it('should add a new item to a delivery', async () => {
      const newItem = testDeliveryItemInput(1, 5, 1, newSalesOrderItemId); // productId 1, quantityOrdered 5, quantityShipped 1, salesOrderItemId 10
      const res = await request(app)
        .post(`/api/v1/deliveries/${existingDeliveryIdPending}/items`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newItem);

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.deliveryId).toBe(existingDeliveryIdPending);
      expect(res.body.data.productId).toBe(newItem.productId);
      expect(res.body.data.quantityShipped).toBe(newItem.quantityShipped);
      expect(res.body.data.salesOrderItemId).toBe(newItem.salesOrderItemId);
      expect(res.body.data.quantityOrderedFromSo).toBe(newItem.quantityOrdered);
    });

    it('should fail to add an item to a non-existent delivery', async () => {
      const res = await request(app)
        .post('/api/v1/deliveries/999999/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testDeliveryItemInput(1, 1, 1, 6));
      expect(res.status).toBe(404);
    });

    it('should fail to add an item to a delivery if status is not editable (PENDING or IN_PREPARATION)', async () => {
      const res = await request(app)
        .post(`/api/v1/deliveries/${existingDeliveryIdShipped}/items`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testDeliveryItemInput(2, 1, 1, 3));
      expect(res.status).toBe(403);
    });
  });

  describe('GET /deliveries/:deliveryId/items', () => {
    it('should return a list of items for a delivery', async () => {
      const res = await request(app)
        .get(`/api/v1/deliveries/${existingDeliveryIdPending}/items`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0]).toHaveProperty('id');
      expect(res.body.data[0].deliveryId).toBe(existingDeliveryIdPending);
    });

    it('should return 404 for a non-existent delivery', async () => {
      const res = await request(app)
        .get('/api/v1/deliveries/999999/items')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /deliveries/:deliveryId/items/:itemId', () => {
    it('should return a specific item by ID for a delivery', async () => {
      const res = await request(app)
        .get(`/api/v1/deliveries/${existingDeliveryIdPending}/items/${existingDeliveryItem1Id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id', existingDeliveryItem1Id);
      expect(res.body.data.deliveryId).toBe(existingDeliveryIdPending);
    });

    it('should return 404 for a non-existent item', async () => {
      const res = await request(app)
        .get(`/api/v1/deliveries/${existingDeliveryIdPending}/items/999999`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('should return 404 for an item not belonging to the specified delivery', async () => {
      const res = await request(app)
        .get(
          `/api/v1/deliveries/${existingDeliveryIdPending}/items/${existingDeliveryItemShippedId}`,
        )
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /deliveries/:deliveryId/items/:itemId', () => {
    const updateData = {
      quantityShipped: 3, // Change to 3 so total shipped (2+3=5) is valid against sales_order_item ID 6 (quantity 5)
    };

    it('should update an existing item in a delivery', async () => {
      const res = await request(app)
        .put(`/api/v1/deliveries/${existingDeliveryIdPending}/items/${existingDeliveryItem1Id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id', existingDeliveryItem1Id);
      expect(res.body.data.quantityShipped).toBe(updateData.quantityShipped);
      expect(res.body.data.quantityOrderedFromSo).toBe(10); // L'item 4 est lié à salesOrderItemId 6 qui a quantity 10
    });

    it('should fail to update an item in a non-existent delivery', async () => {
      const res = await request(app)
        .put(`/api/v1/deliveries/999999/items/${existingDeliveryItem1Id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);
      expect(res.status).toBe(404);
    });

    it('should fail to update a non-existent item in an existing delivery', async () => {
      const res = await request(app)
        .put(`/api/v1/deliveries/${existingDeliveryIdPending}/items/999999`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);
      expect(res.status).toBe(404);
    });

    it('should fail to update an item if delivery status is not editable', async () => {
      const res = await request(app)
        .put(
          `/api/v1/deliveries/${existingDeliveryIdShipped}/items/${existingDeliveryItemShippedId}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantityShipped: 10 });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /deliveries/:deliveryId/items/:itemId', () => {
    it('should delete an item from a delivery', async () => {
      const res = await request(app)
        .delete(`/api/v1/deliveries/${existingDeliveryIdPending}/items/${existingDeliveryItem2Id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);

      const getRes = await request(app)
        .get(`/api/v1/deliveries/${existingDeliveryIdPending}/items/${existingDeliveryItem2Id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.status).toBe(404);
    });

    it('should fail to delete an item from a non-existent delivery', async () => {
      const res = await request(app)
        .delete(`/api/v1/deliveries/999999/items/${existingDeliveryItem1Id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('should fail to delete a non-existent item from an existing delivery', async () => {
      const res = await request(app)
        .delete(`/api/v1/deliveries/${existingDeliveryIdPending}/items/999999`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('should fail to delete an item if delivery status is not editable', async () => {
      const res = await request(app)
        .delete(
          `/api/v1/deliveries/${existingDeliveryIdShipped}/items/${existingDeliveryItemShippedId}`,
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });
  });
});

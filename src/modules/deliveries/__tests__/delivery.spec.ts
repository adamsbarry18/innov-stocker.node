import request from 'supertest';
import { describe, it, expect } from 'vitest';
import app from '@/app';
import { adminToken } from '@/tests/globalSetup';
import dayjs from 'dayjs';

let createdDeliveryId: number;
let createdDeliveryNumber: string;

describe('Deliveries API', () => {
  const createDeliveryInput = {
    salesOrderId: 3, // SO-2025-00003 (Smartphone + Chargeur)
    deliveryDate: dayjs().add(1, 'day').format('YYYY-MM-DD'),
    shippingAddressId: 5, // Client Jean Dupont - Livraison Principale
    dispatchWarehouseId: 1, // Entrepôt Principal Paris Sud
    carrierName: 'Test Carrier',
    trackingNumber: 'TRACK12345',
    notes: 'Test delivery notes',
    items: [
      {
        salesOrderItemId: 4, // Smartphone Modèle X from SO-2025-00003
        quantityShipped: 1.0,
      },
      {
        salesOrderItemId: 5, // Chargeur USB-C Rapide from SO-2025-00003
        quantityShipped: 1.0,
      },
    ],
  };

  const createDeliveryInputNoItems = {
    salesOrderId: 3, // SO-2025-00003 (Smartphone + Chargeur)
    deliveryDate: dayjs().add(2, 'day').format('YYYY-MM-DD'),
    shippingAddressId: 5, // Client Jean Dupont - Livraison Principale
    dispatchWarehouseId: 1, // Entrepôt Principal Paris Sud
    carrierName: 'Test Carrier No Items',
    trackingNumber: 'TRACKNOITEMS',
    notes: 'Test delivery notes no items',
    items: [], // Empty items array
  };
  describe('POST /deliveries', () => {
    it('should create a new delivery with items', async () => {
      const res = await request(app)
        .post('/api/v1/deliveries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createDeliveryInput);

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('deliveryNumber');
      expect(res.body.data.salesOrderId).toBe(createDeliveryInput.salesOrderId);
      expect(res.body.data.items).toHaveLength(2);
      createdDeliveryId = res.body.data.id;
      createdDeliveryNumber = res.body.data.deliveryNumber;
    });

    it('should create a new delivery without items', async () => {
      const res = await request(app)
        .post('/api/v1/deliveries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createDeliveryInputNoItems);

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('deliveryNumber');
      expect(res.body.data.salesOrderId).toBe(createDeliveryInputNoItems.salesOrderId);
      expect(res.body.data.items).toHaveLength(0); // Expect 0 items
    });

    it('should fail to create a delivery with invalid salesOrderId', async () => {
      const invalidInput = { ...createDeliveryInput, salesOrderId: 999999 };
      const res = await request(app)
        .post('/api/v1/deliveries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidInput);
      expect(res.status).toBe(400);
    });

    it('should fail to create a delivery with invalid salesOrderItemId', async () => {
      const invalidInput = {
        ...createDeliveryInput,
        items: [{ salesOrderItemId: 999999, quantityShipped: 1.0 }],
      };
      const res = await request(app)
        .post('/api/v1/deliveries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidInput);
      expect(res.status).toBe(400);
    });

    it('should fail to create a delivery with quantityShipped exceeding available quantity', async () => {
      const invalidInput = {
        ...createDeliveryInput,
        items: [{ salesOrderItemId: 1, quantityShipped: 999.0 }], // SO Item 1 has quantity 1.0
      };
      const res = await request(app)
        .post('/api/v1/deliveries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidInput);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /deliveries', () => {
    it('should return a paginated list of deliveries', async () => {
      const res = await request(app)
        .get('/api/v1/deliveries')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('deliveries');
      expect(Array.isArray(res.body.data.deliveries)).toBe(true);
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data.deliveries.length).toBeGreaterThan(0);
    });

    it('should filter deliveries by salesOrderId', async () => {
      const res = await request(app)
        .get(`/api/v1/deliveries?salesOrderId=${createDeliveryInput.salesOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(
        res.body.data.deliveries.every(
          (d: any) => d.salesOrderId === createDeliveryInput.salesOrderId,
        ),
      ).toBe(true);
    });

    it('should filter deliveries by status', async () => {
      const res = await request(app)
        .get('/api/v1/deliveries?status=pending')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.deliveries.every((d: any) => d.status === 'pending')).toBe(true);
    });

    it('should search deliveries by deliveryNumber', async () => {
      const res = await request(app)
        .get(`/api/v1/deliveries?q=${createdDeliveryNumber.substring(0, 5)}`) // Search by prefix
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(
        res.body.data.deliveries.some((d: any) => d.deliveryNumber === createdDeliveryNumber),
      ).toBe(true);
    });
  });

  describe('GET /deliveries/:id', () => {
    it('should return a delivery by id', async () => {
      const res = await request(app)
        .get(`/api/v1/deliveries/${createdDeliveryId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id', createdDeliveryId);
      expect(res.body.data.deliveryNumber).toBe(createdDeliveryNumber);
    });

    it('should return 404 for non-existent delivery', async () => {
      const res = await request(app)
        .get('/api/v1/deliveries/999999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id format', async () => {
      const res = await request(app)
        .get('/api/v1/deliveries/abc')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /deliveries/:id', () => {
    const updateData = {
      carrierName: 'Updated Carrier',
      trackingNumber: 'UPDATEDTRACK',
      notes: 'Updated notes for delivery',
    };

    it('should update a delivery header', async () => {
      const res = await request(app)
        .put(`/api/v1/deliveries/${createdDeliveryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id', createdDeliveryId);
      expect(res.body.data.carrierName).toBe(updateData.carrierName);
      expect(res.body.data.trackingNumber).toBe(updateData.trackingNumber);
      expect(res.body.data.notes).toBe(updateData.notes);
    });

    it('should return 404 for updating a non-existent delivery', async () => {
      const res = await request(app)
        .put('/api/v1/deliveries/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id format', async () => {
      const res = await request(app)
        .put('/api/v1/deliveries/abc')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(res.status).toBe(400);
    });

    it('should fail to update a delivery if status is SHIPPED or DELIVERED', async () => {
      // First, create a delivery that we can ship and then try to update
      const deliveryToShipInput = {
        salesOrderId: 3,
        deliveryDate: dayjs().add(3, 'day').format('YYYY-MM-DD'),
        shippingAddressId: 5,
        dispatchWarehouseId: 1,
        items: [{ salesOrderItemId: 4, quantityShipped: 1.0 }], // Use SO Item 4 (Smartphone)
      };
      const createRes = await request(app)
        .post('/api/v1/deliveries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(deliveryToShipInput);
      expect(createRes.status).toBe(201);
      const idToShip = createRes.body.data.id;

      // Ship the delivery
      const shipRes = await request(app)
        .patch(`/api/v1/deliveries/${idToShip}/ship`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ actualShipDate: dayjs().format('YYYY-MM-DD') }); // Add actualShipDate
      expect(shipRes.status).toBe(200);
      expect(shipRes.body.data.status).toBe('shipped');

      // Try to update the shipped delivery
      const res = await request(app)
        .put(`/api/v1/deliveries/${idToShip}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Attempt to update shipped delivery' });
      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /deliveries/:id/ship', () => {
    let deliveryToShipId: number;
    it('should create a delivery to be shipped', async () => {
      const deliveryToShipInput = {
        salesOrderId: 3, // SO-2025-00003
        deliveryDate: dayjs().add(4, 'day').format('YYYY-MM-DD'),
        shippingAddressId: 5,
        dispatchWarehouseId: 1,
        items: [{ salesOrderItemId: 4, quantityShipped: 1.0 }], // Ship 1 Smartphone
      };
      const createRes = await request(app)
        .post('/api/v1/deliveries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(deliveryToShipInput);
      expect(createRes.status).toBe(201);
      deliveryToShipId = createRes.body.data.id;
    });

    it('should mark a delivery as shipped', async () => {
      const res = await request(app)
        .patch(`/api/v1/deliveries/${deliveryToShipId}/ship`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ actualShipDate: dayjs().format('YYYY-MM-DD') });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id', deliveryToShipId);
      expect(res.body.data.status).toBe('shipped');
    });

    it('should fail to ship a non-existent delivery', async () => {
      const res = await request(app)
        .patch('/api/v1/deliveries/999999/ship')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ actualShipDate: dayjs().format('YYYY-MM-DD') }); // Add actualShipDate
      expect(res.status).toBe(404);
    });

    it('should fail to ship a delivery already shipped or delivered', async () => {
      const res = await request(app)
        .patch(`/api/v1/deliveries/${deliveryToShipId}/ship`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ actualShipDate: dayjs().format('YYYY-MM-DD') }); // Add actualShipDate
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /deliveries/:id/deliver', () => {
    let deliveryToDeliverId: number;
    it('should create and ship a delivery to be delivered', async () => {
      const deliveryToDeliverInput = {
        salesOrderId: 3,
        deliveryDate: dayjs().add(5, 'day').format('YYYY-MM-DD'),
        shippingAddressId: 5,
        dispatchWarehouseId: 1,
        items: [{ salesOrderItemId: 5, quantityShipped: 1.0 }], // Ship 1 Charger
      };
      const createRes = await request(app)
        .post('/api/v1/deliveries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(deliveryToDeliverInput);
      expect(createRes.status).toBe(201);
      deliveryToDeliverId = createRes.body.data.id;

      const shipRes = await request(app)
        .patch(`/api/v1/deliveries/${deliveryToDeliverId}/ship`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ actualShipDate: dayjs().format('YYYY-MM-DD') }); // Add actualShipDate
      expect(shipRes.status).toBe(200);
      expect(shipRes.body.data.status).toBe('shipped');
    });

    it('should mark a delivery as delivered', async () => {
      const res = await request(app)
        .patch(`/api/v1/deliveries/${deliveryToDeliverId}/deliver`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id', deliveryToDeliverId);
      expect(res.body.data.status).toBe('delivered');
    });

    it('should fail to deliver a non-existent delivery', async () => {
      const res = await request(app)
        .patch('/api/v1/deliveries/999999/deliver')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('should fail to deliver a delivery not in SHIPPED status', async () => {
      // Try to deliver the first created delivery (which is still PENDING)
      const res = await request(app)
        .patch(`/api/v1/deliveries/${createdDeliveryId}/deliver`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /deliveries/:id', () => {
    let deliveryToDeleteId: number;
    it('should create a delivery to be deleted', async () => {
      const deliveryToDeleteInput = {
        salesOrderId: 2,
        deliveryDate: dayjs().add(6, 'day').format('YYYY-MM-DD'),
        shippingAddressId: 6,
        dispatchWarehouseId: 1,
        items: [],
      };
      const createRes = await request(app)
        .post('/api/v1/deliveries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(deliveryToDeleteInput);
      expect(createRes.status).toBe(201);
      deliveryToDeleteId = createRes.body.data.id;
    });

    it('should soft delete a delivery', async () => {
      const res = await request(app)
        .delete(`/api/v1/deliveries/${deliveryToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);

      // Verify it's soft-deleted
      const getRes = await request(app)
        .get(`/api/v1/deliveries/${deliveryToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.status).toBe(404); // Should not be found after soft delete
    });

    it('should return 404 for deleting a non-existent delivery', async () => {
      const res = await request(app)
        .delete('/api/v1/deliveries/999999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id format', async () => {
      const res = await request(app)
        .delete('/api/v1/deliveries/abc')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('should return 400 if the delivery is linked to an invoice', async () => {
      const deliveryIdWithInvoice = 1; // ID de la livraison liée à une facture dans 2-datas.sql
      const res = await request(app)
        .delete(`/api/v1/deliveries/${deliveryIdWithInvoice}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });
  });
});

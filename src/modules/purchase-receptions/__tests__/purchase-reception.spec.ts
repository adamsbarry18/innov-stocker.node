import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import app from '@/app';
import { adminToken } from '@/tests/globalSetup';
import dayjs from 'dayjs';
import { PurchaseReceptionStatus } from '../models/purchase-reception.entity';
import { PurchaseOrderStatus } from '@/modules/purchase-orders/models/purchase-order.entity';

describe('Purchase Receptions API', () => {
  let testSupplierId: number;
  let testWarehouseId: number;
  let testProductId: number;
  let testPurchaseOrderId: number;
  let testPoItemId: number; // This will be dynamically set for each test suite
  let createdReceptionId: number; // ID of a reception created in a POST test
  let receptionToDeleteId: number; // ID of a reception created for deletion test

  const baseReceptionItemPayload = {
    productId: 0, // will be set in beforeAll
    quantityReceived: 5,
    notes: 'Item reçu en bon état',
  };

  const baseReceptionPayload = {
    supplierId: 0, // will be set in beforeAll
    receptionDate: dayjs().format('YYYY-MM-DD'),
    warehouseId: 1, // will be set in beforeAll
    items: [{ ...baseReceptionItemPayload }],
  };

  // Helper function to create a new PO and PO Item for isolated tests
  const createPurchaseOrderWithItem = async (
    supplierId: number,
    productId: number,
    quantity: number,
    price: number,
    token: string,
  ) => {
    const poPayload = {
      supplierId,
      orderDate: dayjs().format('YYYY-MM-DD'),
      expectedDeliveryDate: dayjs().add(7, 'day').format('YYYY-MM-DD'),
      status: PurchaseOrderStatus.PENDING_APPROVAL,
      currencyId: 1, // Assuming EUR as default currency from 2-datas.sql
      warehouseIdForDelivery: testWarehouseId, // Use the test warehouse
      items: [
        {
          productId,
          quantity,
          unitPriceHt: price,
          notes: 'PO Item for test',
        },
      ],
    };

    const poRes = await request(app)
      .post('/api/v1/purchase-orders')
      .set('Authorization', `Bearer ${token}`)
      .send(poPayload);

    expect(poRes.status).toBe(201);
    expect(poRes.body.status).toBe('success');
    expect(poRes.body.data).toHaveProperty('id');
    expect(poRes.body.data.items).toHaveLength(1);

    return {
      purchaseOrderId: poRes.body.data.id,
      purchaseOrderItemId: poRes.body.data.items[0].id,
    };
  };

  beforeAll(async () => {
    // IDs from 2-datas.sql
    testSupplierId = 1; // Fournisseur HighTech Global
    testWarehouseId = 1; // Entrepôt Principal Paris Sud
    testProductId = 1; // Smartphone Modèle X

    // For the initial POST test, we can still use the existing PO item if it's not fully received
    // Or, create a new one to ensure isolation. Let's create a new one for consistency.
    const { purchaseOrderId, purchaseOrderItemId } = await createPurchaseOrderWithItem(
      testSupplierId,
      testProductId,
      30, // Quantity for this PO item
      100,
      adminToken,
    );
    testPurchaseOrderId = purchaseOrderId;
    testPoItemId = purchaseOrderItemId;
  });

  describe('POST /purchase-receptions', () => {
    it('should create a new purchase reception linked to a PO', async () => {
      const payload = {
        ...baseReceptionPayload,
        supplierId: testSupplierId,
        warehouseId: testWarehouseId,
        purchaseOrderId: testPurchaseOrderId,
        items: [
          {
            purchaseOrderItemId: testPoItemId,
            productId: testProductId,
            quantityReceived: 5,
          },
        ],
      };
      const res = await request(app)
        .post('/api/v1/purchase-receptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id');
      createdReceptionId = res.body.data.id;
      expect(res.body.data.purchaseOrderId).toBe(testPurchaseOrderId);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].quantityReceived).toBe(5);
    });

    it('should fail to create a reception if PO does not exist', async () => {
      const payload = {
        ...baseReceptionPayload,
        purchaseOrderId: 999999,
        supplierId: testSupplierId,
        warehouseId: testWarehouseId,
        items: [
          {
            purchaseOrderItemId: testPoItemId,
            productId: testProductId,
            quantityReceived: 1,
          },
        ],
      };
      const res = await request(app)
        .post('/api/v1/purchase-receptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);
      expect(res.status).toBe(404);
    });

    it('should fail to create a reception without items', async () => {
      const payload = {
        ...baseReceptionPayload,
        supplierId: testSupplierId,
        warehouseId: testWarehouseId,
        purchaseOrderId: testPurchaseOrderId,
        items: [],
      };
      const res = await request(app)
        .post('/api/v1/purchase-receptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);
      expect(res.status).toBe(400);
    });

    it('should fail to create reception without authentication', async () => {
      const payload = {
        ...baseReceptionPayload,
        supplierId: testSupplierId,
        warehouseId: testWarehouseId,
        purchaseOrderId: testPurchaseOrderId,
        items: [
          {
            purchaseOrderItemId: testPoItemId,
            productId: testProductId,
            quantityReceived: 1,
          },
        ],
      };
      const res = await request(app).post('/api/v1/purchase-receptions').send(payload);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /purchase-receptions', () => {
    it('should return a list of purchase receptions', async () => {
      const res = await request(app)
        .get('/api/v1/purchase-receptions?limit=5')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('receptions');
      expect(Array.isArray(res.body.data.receptions)).toBe(true);
      expect(res.body.data).toHaveProperty('total');
    });
  });

  describe('GET /purchase-receptions/:id', () => {
    it('should return a specific purchase reception by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/purchase-receptions/${createdReceptionId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.id).toBe(createdReceptionId);
      expect(res.body.data.items).toHaveLength(1);
    });

    it('should return 404 for a non-existent reception ID', async () => {
      const res = await request(app)
        .get(`/api/v1/purchase-receptions/999999`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /purchase-receptions/:id', () => {
    let receptionToUpdateId: number;
    let putTestPoId: number;
    let putTestPoItemId: number;
    let initialReceptionItemId: number;

    beforeAll(async () => {
      const { purchaseOrderId, purchaseOrderItemId } = await createPurchaseOrderWithItem(
        testSupplierId,
        testProductId,
        50,
        100,
        adminToken,
      );
      putTestPoId = purchaseOrderId;
      putTestPoItemId = purchaseOrderItemId;

      const payload = {
        ...baseReceptionPayload,
        supplierId: testSupplierId,
        warehouseId: testWarehouseId,
        purchaseOrderId: putTestPoId,
        items: [
          {
            purchaseOrderItemId: putTestPoItemId,
            productId: testProductId,
            quantityReceived: 1,
          },
        ],
      };
      const res = await request(app)
        .post('/api/v1/purchase-receptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);
      expect(res.status).toBe(201);
      receptionToUpdateId = res.body.data.id;
      initialReceptionItemId = res.body.data.items[0].id;
    });

    it('should update an existing purchase reception (header and items)', async () => {
      const updatedItems = [
        {
          id: initialReceptionItemId,
          purchaseOrderItemId: putTestPoItemId,
          productId: testProductId,
          quantityReceived: 3,
        },
        {
          productId: testProductId,
          quantityReceived: 2,
          quantityOrdered: 2,
          notes: 'New item added during update',
        },
      ];

      const res = await request(app)
        .put(`/api/v1/purchase-receptions/${receptionToUpdateId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          notes: 'Reception mise à jour avec de nouveaux détails.',
          items: updatedItems,
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.notes).toBe('Reception mise à jour avec de nouveaux détails.');
      expect(res.body.data.items).toHaveLength(2);
      expect(
        res.body.data.items.find((item: any) => item.id === initialReceptionItemId)
          .quantityReceived,
      ).toBe(3);
      expect(
        res.body.data.items.find((item: any) => item.notes === 'New item added during update')
          .quantityReceived,
      ).toBe(2);
    });

    it('should fail to update if reception status does not allow modification', async () => {
      let poIdForUpdateFailTest: number;
      let poItemIdForUpdateFailTest: number;

      ({ purchaseOrderId: poIdForUpdateFailTest, purchaseOrderItemId: poItemIdForUpdateFailTest } =
        await createPurchaseOrderWithItem(testSupplierId, testProductId, 10, 100, adminToken));

      const payload = {
        ...baseReceptionPayload,
        supplierId: testSupplierId,
        warehouseId: testWarehouseId,
        purchaseOrderId: poIdForUpdateFailTest,
        items: [
          {
            purchaseOrderItemId: poItemIdForUpdateFailTest,
            productId: testProductId,
            quantityReceived: 1,
          },
        ],
      };
      const addRes = await request(app)
        .post('/api/v1/purchase-receptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);
      expect(addRes.status).toBe(201);
      const receptionId = addRes.body.data.id;

      await request(app)
        .patch(`/api/v1/purchase-receptions/${receptionId}/validate`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .put(`/api/v1/purchase-receptions/${receptionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Attempt to update completed reception' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.notes).toBe('Attempt to update completed reception');
    });
  });

  describe('PATCH /purchase-receptions/:id/validate', () => {
    let receptionToValidateId: number;
    let patchTestPoId: number;
    let patchTestPoItemId: number;

    beforeAll(async () => {
      const { purchaseOrderId, purchaseOrderItemId } = await createPurchaseOrderWithItem(
        testSupplierId,
        testProductId,
        50,
        100,
        adminToken,
      );
      patchTestPoId = purchaseOrderId;
      patchTestPoItemId = purchaseOrderItemId;

      const payload = {
        ...baseReceptionPayload,
        supplierId: testSupplierId,
        warehouseId: testWarehouseId,
        purchaseOrderId: patchTestPoId,
        items: [
          {
            purchaseOrderItemId: patchTestPoItemId,
            productId: testProductId,
            quantityReceived: 5,
          },
        ],
      };
      const res = await request(app)
        .post('/api/v1/purchase-receptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);
      expect(res.status).toBe(201);
      receptionToValidateId = res.body.data.id;
    });

    it('should validate a PENDING_QUALITY_CHECK reception and update stock/PO status', async () => {
      const res = await request(app)
        .patch(`/api/v1/purchase-receptions/${receptionToValidateId}/validate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.status).toBe(PurchaseReceptionStatus.COMPLETE);
    });

    it('should fail to validate a reception not in PENDING_QUALITY_CHECK status', async () => {
      // Reception ID 1 from 2-datas.sql is 'complete'
      const receptionId = 1;

      const res = await request(app)
        .patch(`/api/v1/purchase-receptions/${receptionId}/validate`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /purchase-receptions/:id', () => {
    let deleteTestPoId: number;
    let deleteTestPoItemId: number;

    beforeAll(async () => {
      ({ purchaseOrderId: deleteTestPoId, purchaseOrderItemId: deleteTestPoItemId } =
        await createPurchaseOrderWithItem(testSupplierId, testProductId, 50, 100, adminToken));

      const payload = {
        ...baseReceptionPayload,
        supplierId: testSupplierId,
        warehouseId: testWarehouseId,
        purchaseOrderId: deleteTestPoId,
        items: [
          {
            purchaseOrderItemId: deleteTestPoItemId,
            productId: testProductId,
            quantityReceived: 1,
          },
        ],
      };
      const res = await request(app)
        .post('/api/v1/purchase-receptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);
      expect(res.status).toBe(201);
      receptionToDeleteId = res.body.data.id;
    });

    it('should soft delete a purchase reception if status allows', async () => {
      const res = await request(app)
        .delete(`/api/v1/purchase-receptions/${receptionToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);

      const getRes = await request(app)
        .get(`/api/v1/purchase-receptions/${receptionToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.status).toBe(404);
    });

    it('should fail to delete a reception if status does not allow', async () => {
      // Reception ID 1 from 2-datas.sql is 'complete'
      const receptionId = 1;

      // Validate it to change its status to COMPLETE
      await request(app)
        .patch(`/api/v1/purchase-receptions/${receptionId}/validate`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .delete(`/api/v1/purchase-receptions/${receptionId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });
});

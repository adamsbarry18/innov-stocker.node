import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

import app from '@/app';
import { adminToken } from '@/tests/globalSetup';

// IDs des données pré-existantes dans 2-datas.sql
// Utilisateurs: 1 (Admin Test), 2 (User Test)
// Entrepôts: 1 (Entrepôt Principal Paris Sud), 2 (Entrepôt Secondaire Lille Nord)
// Boutiques: 1 (Boutique InnovStocker Nantes), 2 (Boutique InnovStocker Strasbourg)
// Produits: 1 (Smartphone Modèle X), 2 (Ordinateur Portable Pro 15"), 3 (Chargeur USB-C Rapide)
// Variantes de produits: 1 (Smartphone Modèle X - Bleu)

const testStockTransferInputWithItems = {
  transferNumber: `TRF-TEST-${Date.now()}`, // Ce numéro sera ignoré par le service
  sourceWarehouseId: 1,
  destinationShopId: 1,
  requestDate: dayjs().format('YYYY-MM-DD'),
  notes: `Test stock transfer with items ${Date.now()}`, // Rendre les notes uniques
  items: [
    {
      productId: 1, // Smartphone Modèle X
      quantityRequested: 5,
    },
    {
      productId: 3, // Chargeur USB-C Rapide
      quantityRequested: 10,
    },
  ],
};

const testStockTransferInputNoItems = {
  transferNumber: `TRF-TEST-NOITEMS-${Date.now()}`,
  sourceShopId: 1,
  destinationWarehouseId: 2,
  requestDate: dayjs().format('YYYY-MM-DD'),
  notes: 'Test stock transfer without items',
  items: [],
};

describe('StockTransfers API', () => {
  let createdTransferId: number;

  describe('POST /stock-transfers', () => {
    it('should create a new stock transfer with items', async () => {
      const res = await request(app)
        .post('/api/v1/stock-transfers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...testStockTransferInputWithItems });
      createdTransferId = res.body.data.id;
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.items).toHaveLength(2);
      expect(res.body.data.sourceWarehouseId).toBe(
        testStockTransferInputWithItems.sourceWarehouseId,
      );
      expect(res.body.data.destinationShopId).toBe(
        testStockTransferInputWithItems.destinationShopId,
      );
    });

    it('should return 400 if trying to create a new stock transfer without items', async () => {
      const res = await request(app)
        .post('/api/v1/stock-transfers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...testStockTransferInputNoItems });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid input (missing required fields)', async () => {
      const invalidInput = {
        sourceWarehouseId: 1,
        destinationShopId: 1,
        // Missing transferNumber and requestDate
      };
      const res = await request(app)
        .post('/api/v1/stock-transfers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidInput);
      expect(res.status).toBe(400);
    });

    it('should return 400 if both sourceWarehouseId and sourceShopId are provided', async () => {
      const invalidInput = {
        transferNumber: `TRF-INVALID-SRC-${Date.now()}`,
        sourceWarehouseId: 1,
        sourceShopId: 1,
        destinationShopId: 1,
        requestDate: dayjs().format('YYYY-MM-DD'),
      };
      const res = await request(app)
        .post('/api/v1/stock-transfers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidInput);
      expect(res.status).toBe(400);
    });

    it('should return 400 if both destinationWarehouseId and destinationShopId are provided', async () => {
      const invalidInput = {
        transferNumber: `TRF-INVALID-DEST-${Date.now()}`,
        sourceWarehouseId: 1,
        destinationWarehouseId: 1,
        destinationShopId: 1,
        requestDate: dayjs().format('YYYY-MM-DD'),
      };
      const res = await request(app)
        .post('/api/v1/stock-transfers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidInput);
      expect(res.status).toBe(400);
    });

    it('should return 400 if source and destination are the same type and ID', async () => {
      const invalidInput = {
        transferNumber: `TRF-SAME-LOC-${Date.now()}`,
        sourceWarehouseId: 1,
        destinationWarehouseId: 1,
        requestDate: dayjs().format('YYYY-MM-DD'),
      };
      const res = await request(app)
        .post('/api/v1/stock-transfers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidInput);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /stock-transfers', () => {
    it('should return a paginated list of stock transfers', async () => {
      const res = await request(app)
        .get('/api/v1/stock-transfers')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('transfers');
      expect(Array.isArray(res.body.data.transfers)).toBe(true);
      expect(res.body.data).toHaveProperty('total');
    });

    it('should filter stock transfers by status', async () => {
      const res = await request(app)
        .get('/api/v1/stock-transfers?status=shipped')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(
        (res.body.data.transfers as Array<{ status: string }>).every((t) => t.status === 'shipped'),
      ).toBe(true);
    });

    it('should search stock transfers by transferNumber or notes', async () => {
      const res = await request(app)
        .get(`/api/v1/stock-transfers?q=${testStockTransferInputWithItems.notes}`) // Search by notes
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      const transfers: Array<{ notes: string }> = res.body.data.transfers;
      expect(transfers.some((t) => t.notes === testStockTransferInputWithItems.notes)).toBe(true);
    });
  });

  describe('GET /stock-transfers/:id', () => {
    it('should return a stock transfer by id', async () => {
      const res = await request(app)
        .get(`/api/v1/stock-transfers/${createdTransferId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id', createdTransferId);
      expect(res.body.data.items).toHaveLength(2); // Should include items by default
    });

    it('should return a stock transfer by id without items if includeItems=false', async () => {
      const res = await request(app)
        .get(`/api/v1/stock-transfers/${createdTransferId}?includeItems=false`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id', createdTransferId);
      expect(res.body.data).not.toHaveProperty('items');
    });

    it('should return 404 for non-existent stock transfer', async () => {
      const res = await request(app)
        .get('/api/v1/stock-transfers/999999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id format', async () => {
      const res = await request(app)
        .get('/api/v1/stock-transfers/abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /stock-transfers/:id', () => {
    let pendingTransferId: number;
    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/stock-transfers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          transferNumber: `TRF-PENDING-UPDATE-${Date.now()}`,
          sourceWarehouseId: 1,
          destinationShopId: 1,
          requestDate: dayjs().format('YYYY-MM-DD'),
          notes: 'Transfer for update test',
          items: [{ productId: 1, quantityRequested: 1 }],
        });
      pendingTransferId = res.body.data.id;
    });

    it('should update a pending stock transfer (header and items)', async () => {
      const updateData = {
        notes: 'Updated notes for transfer',
        items: [
          { productId: 1, quantityRequested: 2 }, // Update existing item (Smartphone Modèle X)
          { productId: 2, quantityRequested: 3 }, // Add new item (Ordinateur Portable Pro 15")
        ],
      };
      const res = await request(app)
        .put(`/api/v1/stock-transfers/${pendingTransferId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);
      expect(res.status).toBe(200);
      expect(res.body.data.notes).toBe(updateData.notes);
      expect(res.body.data.items).toHaveLength(2);
      const items = res.body.data.items as Array<{ productId: number; quantityRequested: number }>;
      const item1 = items.find((item) => item.productId === 1);
      expect(item1).toBeDefined();
      expect(item1?.quantityRequested).toBe(2);
      expect(
        (res.body.data.items as Array<{ productId: number; quantityRequested: number }>).find(
          (item) => item.productId === 2,
        )?.quantityRequested,
      ).toBe(3);
    });

    it('should return 403 if trying to update a non-pending transfer', async () => {
      // Use a shipped transfer from initial data (ID 1)
      const shippedTransferId = 1;
      const updateData = { notes: 'Attempt to update shipped transfer' };
      const res = await request(app)
        .put(`/api/v1/stock-transfers/${shippedTransferId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);
      expect(res.status).toBe(403);
    });

    it('should return 404 for updating a non-existent stock transfer', async () => {
      const updateData = { notes: 'Non existent' };
      const res = await request(app)
        .put('/api/v1/stock-transfers/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id format', async () => {
      const updateData = { notes: 'Invalid ID' };
      const res = await request(app)
        .put('/api/v1/stock-transfers/abc')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /stock-transfers/:id/ship', () => {
    let pendingTransferToShipId: number;
    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/stock-transfers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          transferNumber: `TRF-SHIP-TEST-${Date.now()}`,
          sourceWarehouseId: 1,
          destinationShopId: 1,
          requestDate: dayjs().format('YYYY-MM-DD'),
          notes: 'Transfer for ship test',
          items: [
            { productId: 1, quantityRequested: 5 },
            { productId: 3, quantityRequested: 10 },
          ],
        });
      pendingTransferToShipId = res.body.data.id;
    });

    it('should mark a stock transfer as shipped and update quantities', async () => {
      // Récupérer les détails du transfert pour obtenir les IDs réels des items
      const transferDetails = await request(app)
        .get(`/api/v1/stock-transfers/${pendingTransferToShipId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const shipInput = {
        items: [
          { stockTransferItemId: transferDetails.body.data.items[0].id, quantityShipped: 5 },
          { stockTransferItemId: transferDetails.body.data.items[1].id, quantityShipped: 8 },
        ],
      };

      const res = await request(app)
        .patch(`/api/v1/stock-transfers/${pendingTransferToShipId}/ship`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(shipInput);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('in_transit');
      expect(dayjs(res.body.data.shipDate).format('YYYY-MM-DD')).toBe(dayjs().format('YYYY-MM-DD'));
      const items: Array<{ id: number; quantityShipped: number }> = res.body.data.items;
      expect(
        items.find((item) => item.id === shipInput.items[0].stockTransferItemId)?.quantityShipped,
      ).toBe(5);
      expect(
        items.find((item) => item.id === shipInput.items[1].stockTransferItemId)?.quantityShipped,
      ).toBe(8);
    });

    it('should return 400 if trying to ship a non-pending transfer', async () => {
      // Use a shipped transfer from initial data (ID 1)
      const shippedTransferId = 1;
      const shipInput = { items: [] };
      const res = await request(app)
        .patch(`/api/v1/stock-transfers/${shippedTransferId}/ship`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(shipInput);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent stock transfer', async () => {
      const shipInput = { items: [] };
      const res = await request(app)
        .patch('/api/v1/stock-transfers/999999/ship')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(shipInput);
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id format', async () => {
      const shipInput = { items: [] };
      const res = await request(app)
        .patch('/api/v1/stock-transfers/abc/ship')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(shipInput);
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid quantityShipped (greater than quantityRequested)', async () => {
      const transferDetails = await request(app)
        .get(`/api/v1/stock-transfers/${pendingTransferToShipId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      const invalidShipInput = {
        items: [
          { stockTransferItemId: transferDetails.body.data.items[0].id, quantityShipped: 100 }, // Requested was 5
        ],
      };
      const res = await request(app)
        .patch(`/api/v1/stock-transfers/${pendingTransferToShipId}/ship`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidShipInput);
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /stock-transfers/:id/receive', () => {
    let inTransitTransferToReceiveId: number;
    beforeEach(async () => {
      // Create a pending transfer
      const createRes = await request(app)
        .post('/api/v1/stock-transfers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          transferNumber: `TRF-RECEIVE-TEST-${Date.now()}`,
          sourceWarehouseId: 1,
          destinationShopId: 1,
          requestDate: dayjs().format('YYYY-MM-DD'),
          notes: 'Transfer for receive test',
          items: [
            { productId: 1, quantityRequested: 5 },
            { productId: 3, quantityRequested: 10 },
          ],
        });
      inTransitTransferToReceiveId = createRes.body.data.id;

      // Ship it to put it in 'in_transit' status
      const transferDetails = await request(app)
        .get(`/api/v1/stock-transfers/${inTransitTransferToReceiveId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      const shipInput = {
        items: [
          { stockTransferItemId: transferDetails.body.data.items[0].id, quantityShipped: 5 },
          { stockTransferItemId: transferDetails.body.data.items[1].id, quantityShipped: 10 },
        ],
      };
      await request(app)
        .patch(`/api/v1/stock-transfers/${inTransitTransferToReceiveId}/ship`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(shipInput);
    });

    it('should mark a stock transfer as received (fully)', async () => {
      // Récupérer les détails du transfert pour obtenir les IDs réels des items
      const transferDetails = await request(app)
        .get(`/api/v1/stock-transfers/${inTransitTransferToReceiveId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const receiveInput = {
        items: [
          { stockTransferItemId: transferDetails.body.data.items[0].id, quantityReceived: 5 },
          { stockTransferItemId: transferDetails.body.data.items[1].id, quantityReceived: 10 },
        ],
      };

      const res = await request(app)
        .patch(`/api/v1/stock-transfers/${inTransitTransferToReceiveId}/receive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(receiveInput);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('received');
      expect(dayjs(res.body.data.receiveDate).format('YYYY-MM-DD')).toBe(
        dayjs().format('YYYY-MM-DD'),
      );
      expect(
        (res.body.data.items as Array<{ id: number; quantityReceived: number }>).find(
          (item) => item.id === receiveInput.items[0].stockTransferItemId,
        )!.quantityReceived,
      ).toBe(5);
      expect(
        (res.body.data.items as Array<{ id: number; quantityReceived: number }>).find(
          (item) => item.id === receiveInput.items[1].stockTransferItemId,
        )!.quantityReceived,
      ).toBe(10);
    });

    it('should mark a stock transfer as partially_received', async () => {
      // Récupérer les détails du transfert pour obtenir les IDs réels des items
      const transferDetails = await request(app)
        .get(`/api/v1/stock-transfers/${inTransitTransferToReceiveId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const receiveInput = {
        items: [
          { stockTransferItemId: transferDetails.body.data.items[0].id, quantityReceived: 3 }, // Partial
          { stockTransferItemId: transferDetails.body.data.items[1].id, quantityReceived: 10 }, // Full
        ],
      };

      const res = await request(app)
        .patch(`/api/v1/stock-transfers/${inTransitTransferToReceiveId}/receive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(receiveInput);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('partially_received');
      expect(
        (res.body.data.items as Array<{ id: number; quantityReceived: number }>).find(
          (item) => item.id === receiveInput.items[0].stockTransferItemId,
        )!.quantityReceived,
      ).toBe(3);
    });

    it('should return 400 if trying to receive a non-in_transit transfer', async () => {
      // Use a received transfer from initial data (ID 2)
      const receivedTransferId = 2;
      const receiveInput = { items: [] };
      const res = await request(app)
        .patch(`/api/v1/stock-transfers/${receivedTransferId}/receive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(receiveInput);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent stock transfer', async () => {
      const receiveInput = { items: [] };
      const res = await request(app)
        .patch('/api/v1/stock-transfers/999999/receive')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(receiveInput);
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id format', async () => {
      const receiveInput = { items: [] };
      const res = await request(app)
        .patch('/api/v1/stock-transfers/abc/receive')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(receiveInput);
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid quantityReceived (greater than quantityShipped)', async () => {
      const transferDetails = await request(app)
        .get(`/api/v1/stock-transfers/${inTransitTransferToReceiveId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      const invalidReceiveInput = {
        items: [
          { stockTransferItemId: transferDetails.body.data.items[0].id, quantityReceived: 100 }, // Shipped was 5
        ],
      };
      const res = await request(app)
        .patch(`/api/v1/stock-transfers/${inTransitTransferToReceiveId}/receive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidReceiveInput);
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /stock-transfers/:id/cancel', () => {
    let pendingTransferToCancelId: number;
    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/stock-transfers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          transferNumber: `TRF-CANCEL-TEST-${Date.now()}`,
          sourceWarehouseId: 1,
          destinationShopId: 1,
          requestDate: dayjs().format('YYYY-MM-DD'),
          notes: 'Transfer for cancel test',
          items: [{ productId: 1, quantityRequested: 1 }],
        });
      pendingTransferToCancelId = res.body.data.id;
    });

    it('should cancel a pending stock transfer', async () => {
      const res = await request(app)
        .patch(`/api/v1/stock-transfers/${pendingTransferToCancelId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('cancelled');
    });

    it('should return 403 if trying to cancel a non-pending transfer', async () => {
      // Use a shipped transfer from initial data (ID 1)
      const shippedTransferId = 1;
      const res = await request(app)
        .patch(`/api/v1/stock-transfers/${shippedTransferId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 404 for non-existent stock transfer', async () => {
      const res = await request(app)
        .patch('/api/v1/stock-transfers/999999/cancel')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id format', async () => {
      const res = await request(app)
        .patch('/api/v1/stock-transfers/abc/cancel')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /stock-transfers/:id', () => {
    let transferToDeleteId: number;
    let cancelledTransferToDeleteId: number;

    beforeEach(async () => {
      // Create a new pending transfer specifically for deletion test
      const resPending = await request(app)
        .post('/api/v1/stock-transfers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          transferNumber: `TRF-DELETE-PENDING-${Date.now()}`,
          sourceWarehouseId: 1,
          destinationShopId: 1,
          requestDate: dayjs().format('YYYY-MM-DD'),
          notes: 'Transfer for deletion test (pending)',
          items: [{ productId: 1, quantityRequested: 1 }], // Ajout d'un item pour que la création réussisse
        });
      transferToDeleteId = resPending.body.data.id;

      // Create a new cancelled transfer specifically for deletion test
      const resCancelled = await request(app)
        .post('/api/v1/stock-transfers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          transferNumber: `TRF-DELETE-CANCELLED-${Date.now()}`,
          sourceWarehouseId: 1,
          destinationShopId: 1,
          requestDate: dayjs().format('YYYY-MM-DD'),
          notes: 'Transfer for deletion test (cancelled)',
          items: [{ productId: 1, quantityRequested: 1 }], // Ajout d'un item pour que la création réussisse
        });
      cancelledTransferToDeleteId = resCancelled.body.data.id;
      await request(app)
        .patch(`/api/v1/stock-transfers/${cancelledTransferToDeleteId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`);
    });

    it('should delete a pending stock transfer', async () => {
      const res = await request(app)
        .delete(`/api/v1/stock-transfers/${transferToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);
    });

    it('should delete a cancelled stock transfer', async () => {
      const res = await request(app)
        .delete(`/api/v1/stock-transfers/${cancelledTransferToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);
    });

    it('should return 400 if trying to delete a shipped transfer', async () => {
      // Use a shipped transfer from initial data (ID 1)
      const shippedTransferId = 1;
      const res = await request(app)
        .delete(`/api/v1/stock-transfers/${shippedTransferId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });

    it('should return 404 for deleting a non-existent stock transfer', async () => {
      const res = await request(app)
        .delete('/api/v1/stock-transfers/999999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id format', async () => {
      const res = await request(app)
        .delete('/api/v1/stock-transfers/abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { adminToken } from '@/tests/globalSetup';
import dayjs from 'dayjs';
import { SupplierReturnStatus } from '../models/supplier-return.entity';

// IDs des données pré-existantes dans 2-datas.sql
// Fournisseurs: 1 (Fournisseur HighTech Global), 2 (Office Supplies Express)
// Produits: 1 (Smartphone), 2 (Laptop), 3 (Chargeur)
// Purchase Receptions: 1 (REC-2025-00001), 2 (REC-2025-00002)
// Purchase Reception Items: 1 (Smartphone from REC1), 2 (Chargeur from REC2)
// Entrepôts: 1 (Entrepôt Principal Paris Sud), 2 (Entrepôt Secondaire Lille Nord)
// Boutiques: 1 (Boutique InnovStocker Nantes), 2 (Boutique InnovStocker Strasbourg)

const testSupplierReturnInputWithItems = {
  supplierId: 1, // Fournisseur HighTech Global
  returnDate: dayjs().format('YYYY-MM-DD'),
  reason: 'Produit défectueux à la réception',
  notes: 'Retour pour remplacement',
  sourceWarehouseId: 1, // Entrepôt Principal Paris Sud
  items: [
    {
      productId: 1, // Smartphone Modèle X
      quantity: 1,
      unitPriceAtReturn: 350.0,
      purchaseReceptionItemId: 1, // Lié à REC-2025-00001
      productVariantId: null, // Explicitly null as per 2-datas.sql
    },
    {
      productId: 3, // Chargeur USB-C Rapide
      quantity: 2,
      unitPriceAtReturn: 9.5,
      purchaseReceptionItemId: 2, // Lié à REC-2025-00002
      productVariantId: null, // Explicitly null as per 2-datas.sql
    },
  ],
};

const testSupplierReturnInputNoItems = {
  supplierId: 2, // Office Supplies Express
  returnDate: dayjs().format('YYYY-MM-DD'),
  reason: 'Erreur de commande',
  notes: 'Retour sans articles initiaux, sera ajouté plus tard',
  sourceShopId: 1, // Boutique InnovStocker Nantes
  items: [],
};

describe('SupplierReturns API', () => {
  let createdReturnId: number;
  let createdReturnIdNoItems: number;

  describe('POST /supplier-returns', () => {
    it('should create a new supplier return with items', async () => {
      const res = await request(app)
        .post('/api/v1/supplier-returns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testSupplierReturnInputWithItems);
      createdReturnId = res.body.data.id;
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.supplierId).toBe(testSupplierReturnInputWithItems.supplierId);
      expect(res.body.data.items).toHaveLength(2);
      expect(res.body.data.status).toBe(SupplierReturnStatus.REQUESTED);
    });

    it('should create a new supplier return without items (should fail as items are required)', async () => {
      const res = await request(app)
        .post('/api/v1/supplier-returns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testSupplierReturnInputNoItems);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /supplier-returns', () => {
    it('should return a paginated list of supplier returns', async () => {
      const res = await request(app)
        .get('/api/v1/supplier-returns')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('returns');
      expect(Array.isArray(res.body.data.returns)).toBe(true);
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data.returns.length).toBeGreaterThanOrEqual(3); // Existing + newly created
    });

    it('should filter supplier returns by supplierId', async () => {
      const res = await request(app)
        .get(`/api/v1/supplier-returns?supplierId=${testSupplierReturnInputWithItems.supplierId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(
        res.body.data.returns.every(
          (r: any) => r.supplierId === testSupplierReturnInputWithItems.supplierId,
        ),
      ).toBe(true);
    });

    it('should filter supplier returns by status', async () => {
      const res = await request(app)
        .get(`/api/v1/supplier-returns?status=${SupplierReturnStatus.REQUESTED}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(
        res.body.data.returns.every((r: any) => r.status === SupplierReturnStatus.REQUESTED),
      ).toBe(true);
    });
  });

  describe('GET /supplier-returns/:id', () => {
    it('should return a supplier return by id', async () => {
      const res = await request(app)
        .get(`/api/v1/supplier-returns/${createdReturnId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id', createdReturnId);
      expect(res.body.data.items).toHaveLength(2);
    });

    it('should return 404 for non-existent supplier return', async () => {
      const res = await request(app)
        .get('/api/v1/supplier-returns/999999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id format', async () => {
      const res = await request(app)
        .get('/api/v1/supplier-returns/abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /supplier-returns/:id', () => {
    const updateData = {
      reason: 'Produit endommagé à la livraison - Mise à jour',
      notes: 'Notes mises à jour pour le retour',
    };

    it('should update a supplier return', async () => {
      const res = await request(app)
        .put(`/api/v1/supplier-returns/${createdReturnId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);
      expect(res.status).toBe(200);
      expect(res.body.data.reason).toBe(updateData.reason);
      expect(res.body.data.notes).toBe(updateData.notes);
    });

    it('should return 404 for updating a non-existent supplier return', async () => {
      const res = await request(app)
        .put('/api/v1/supplier-returns/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id format', async () => {
      const res = await request(app)
        .put('/api/v1/supplier-returns/abc')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /supplier-returns/:id/approve', () => {
    let returnToApproveId: number;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/supplier-returns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...testSupplierReturnInputWithItems,
          notes: 'Return to approve',
          returnDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
        });
      returnToApproveId = res.body.data.id;
    });

    it('should approve a supplier return request', async () => {
      const res = await request(app)
        .patch(`/api/v1/supplier-returns/${returnToApproveId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ supplierRmaNumber: 'RMA-TEST-001', notes: 'Approved by test' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(SupplierReturnStatus.APPROVED_BY_SUPPLIER);
      expect(res.body.data.supplierRmaNumber).toBe('RMA-TEST-001');
    });

    it('should return 404 for non-existent supplier return', async () => {
      const res = await request(app)
        .patch('/api/v1/supplier-returns/999999/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id format', async () => {
      const res = await request(app)
        .patch('/api/v1/supplier-returns/abc/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /supplier-returns/:id/ship', () => {
    let returnToShipId: number;
    let returnItemToShipId: number;
    let returnItemToShipId2: number;

    beforeEach(async () => {
      const createRes = await request(app)
        .post('/api/v1/supplier-returns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...testSupplierReturnInputWithItems,
          notes: 'Return to ship items',
          returnDate: dayjs().subtract(2, 'day').format('YYYY-MM-DD'),
        });
      returnToShipId = createRes.body.data.id;
      returnItemToShipId = createRes.body.data.items[0].id; // Get ID of the first item
      returnItemToShipId2 = createRes.body.data.items[1].id;
      // Approve the return before attempting to ship items
      await request(app)
        .patch(`/api/v1/supplier-returns/${returnToShipId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Approved for shipment test' });
    });

    it('should record shipment of returned items', async () => {
      const res = await request(app)
        .patch(`/api/v1/supplier-returns/${returnToShipId}/ship`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          shipDate: dayjs().format('YYYY-MM-DD'),
          carrierName: 'DHL',
          trackingNumber: 'TRACK12345',
          notes: 'Items shipped in good condition',
          items: [
            {
              id: returnItemToShipId,
              quantityShipped: testSupplierReturnInputWithItems.items[0].quantity,
            },
            {
              id: returnItemToShipId2,
              quantityShipped: testSupplierReturnInputWithItems.items[1].quantity,
            },
          ],
        });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(SupplierReturnStatus.SHIPPED_TO_SUPPLIER);
      expect(res.body.data.items[0].quantityShipped).toBe(1);
    });

    it('should return 404 for non-existent supplier return', async () => {
      const res = await request(app)
        .patch('/api/v1/supplier-returns/999999/ship')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ items: [] });
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id format', async () => {
      const res = await request(app)
        .patch('/api/v1/supplier-returns/abc/ship')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ items: [] });
      expect(res.status).toBe(400);
    });

    it('should return 400 if quantityShipped exceeds quantity to return', async () => {
      const res = await request(app)
        .patch(`/api/v1/supplier-returns/${returnToShipId}/ship`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          items: [
            {
              id: returnItemToShipId,
              quantityShipped: 999, // Exceeds original quantity
            },
          ],
        });
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /supplier-returns/:id/complete', () => {
    let returnToCompleteId: number;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/supplier-returns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...testSupplierReturnInputWithItems,
          notes: 'Return to complete',
          returnDate: dayjs().subtract(3, 'day').format('YYYY-MM-DD'),
        });
      returnToCompleteId = res.body.data.id;

      // Transition to a status that allows completion
      await request(app)
        .patch(`/api/v1/supplier-returns/${returnToCompleteId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      await request(app)
        .patch(`/api/v1/supplier-returns/${returnToCompleteId}/ship`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          items: [
            {
              id: res.body.data.items[0].id,
              quantityShipped: res.body.data.items[0].quantity,
            },
            {
              id: res.body.data.items[1].id,
              quantityShipped: res.body.data.items[1].quantity,
            },
          ],
        });
    });

    it('should complete the supplier return process', async () => {
      const res = await request(app)
        .patch(`/api/v1/supplier-returns/${returnToCompleteId}/complete`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          completionDate: dayjs().format('YYYY-MM-DD'),
          resolutionNotes: 'Credit note received',
        });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(SupplierReturnStatus.COMPLETED);
    });

    it('should return 404 for non-existent supplier return', async () => {
      const res = await request(app)
        .patch('/api/v1/supplier-returns/999999/complete')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id format', async () => {
      const res = await request(app)
        .patch('/api/v1/supplier-returns/abc/complete')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /supplier-returns/:id/cancel', () => {
    let returnToCancelId: number;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/supplier-returns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...testSupplierReturnInputWithItems,
          notes: 'Return to cancel',
          returnDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
        });
      returnToCancelId = res.body.data.id;
    });

    it('should cancel a supplier return request', async () => {
      const res = await request(app)
        .patch(`/api/v1/supplier-returns/${returnToCancelId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(SupplierReturnStatus.CANCELLED);
    });

    it('should return 404 for non-existent supplier return', async () => {
      const res = await request(app)
        .patch('/api/v1/supplier-returns/999999/cancel')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id format', async () => {
      const res = await request(app)
        .patch('/api/v1/supplier-returns/abc/cancel')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /supplier-returns/:id', () => {
    let returnToDeleteId: number;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/supplier-returns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...testSupplierReturnInputWithItems,
          notes: 'Return to delete',
          returnDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
        });
      returnToDeleteId = res.body.data.id;
    });

    it('should delete a supplier return', async () => {
      const res = await request(app)
        .delete(`/api/v1/supplier-returns/${returnToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);
    });

    it('should return 404 for deleting a non-existent supplier return', async () => {
      const res = await request(app)
        .delete('/api/v1/supplier-returns/999999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id format', async () => {
      const res = await request(app)
        .delete('/api/v1/supplier-returns/abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });
});

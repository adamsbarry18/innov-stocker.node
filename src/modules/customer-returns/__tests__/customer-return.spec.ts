import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { adminToken } from '@/tests/globalSetup';
import dayjs from 'dayjs';
import { CustomerReturnStatus } from '../models/customer-return.entity';
import {
  ReturnedItemCondition,
  ReturnItemActionTaken,
} from '../customer-return-items/models/customer-return-item.entity';

// IDs des données pré-existantes dans 2-datas.sql
// Clients: 1 (Jean Dupont), 2 (Entreprise ABC SARL)
// Produits: 1 (Smartphone), 2 (Laptop), 3 (Chargeur)
// Sales Orders: 1 (SO-2025-00001), 2 (SO-2025-00002)
// Customer Invoices: 1 (INV-CUST-2025-00001), 2 (INV-CUST-2025-00002)

const testCustomerReturnInputWithItems = {
  customerId: 1, // Jean Dupont
  salesOrderId: 1, // SO-2025-00001
  customerInvoiceId: 1, // INV-CUST-2025-00001
  returnDate: dayjs().format('YYYY-MM-DD'),
  reason: 'Produit non conforme à la description',
  notes: 'Retour pour échange de taille',
  warehouseId: 1, // Ajout d'un entrepôt pour les mouvements de stock
  items: [
    {
      productId: 2, // Laptop
      quantity: 2,
      unitPriceAtReturn: 975.0,
      condition: ReturnedItemCondition.NEW,
      actionTaken: ReturnItemActionTaken.PENDING_INSPECTION,
    },
    {
      productId: 3, // Chargeur
      quantity: 2,
      unitPriceAtReturn: 24.0,
      condition: ReturnedItemCondition.NEW,
      actionTaken: ReturnItemActionTaken.PENDING_INSPECTION,
    },
  ],
};

const testCustomerReturnInputNoItems = {
  customerId: 2, // Entreprise ABC SARL
  salesOrderId: 2, // SO-2025-00002
  customerInvoiceId: 2, // INV-CUST-2025-00002
  returnDate: dayjs().format('YYYY-MM-DD'),
  reason: "Changement d'avis",
  notes: 'Retour sans articles initiaux, sera ajouté plus tard',
  items: [],
};

describe('CustomerReturns API', () => {
  let createdReturnId: number;
  let createdReturnIdNoItems: number;

  describe('POST /customer-returns', () => {
    it('should create a new customer return with items', async () => {
      const res = await request(app)
        .post('/api/v1/customer-returns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testCustomerReturnInputWithItems);
      createdReturnId = res.body.data.id;
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.customerId).toBe(testCustomerReturnInputWithItems.customerId);
      expect(res.body.data.items).toHaveLength(2);
      expect(res.body.data.status).toBe(CustomerReturnStatus.REQUESTED);
    });

    it('should create a new customer return without items', async () => {
      const res = await request(app)
        .post('/api/v1/customer-returns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testCustomerReturnInputNoItems);
      createdReturnIdNoItems = res.body.data.id;
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.customerId).toBe(testCustomerReturnInputNoItems.customerId);
      expect(res.body.data.items).toHaveLength(0);
      expect(res.body.data.status).toBe(CustomerReturnStatus.REQUESTED);
    });
  });

  describe('GET /customer-returns', () => {
    it('should return a paginated list of customer returns', async () => {
      const res = await request(app)
        .get('/api/v1/customer-returns')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('returns');
      expect(Array.isArray(res.body.data.returns)).toBe(true);
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data.returns.length).toBeGreaterThanOrEqual(2); // Existing + newly created
    });

    it('should filter customer returns by customerId', async () => {
      const res = await request(app)
        .get(`/api/v1/customer-returns?customerId=${testCustomerReturnInputWithItems.customerId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(
        res.body.data.returns.every(
          (r: any) => r.customerId === testCustomerReturnInputWithItems.customerId,
        ),
      ).toBe(true);
    });

    it('should filter customer returns by status', async () => {
      const res = await request(app)
        .get(`/api/v1/customer-returns?status=${CustomerReturnStatus.REQUESTED}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(
        res.body.data.returns.every((r: any) => r.status === CustomerReturnStatus.REQUESTED),
      ).toBe(true);
    });
  });

  describe('GET /customer-returns/:id', () => {
    it('should return a customer return by id', async () => {
      const res = await request(app)
        .get(`/api/v1/customer-returns/${createdReturnId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id', createdReturnId);
      expect(res.body.data.items).toHaveLength(2);
    });

    it('should return 404 for non-existent customer return', async () => {
      const res = await request(app)
        .get('/api/v1/customer-returns/999999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id format', async () => {
      const res = await request(app)
        .get('/api/v1/customer-returns/abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /customer-returns/:id', () => {
    const updateData = {
      reason: 'Produit endommagé à la livraison - Mise à jour',
      notes: 'Notes mises à jour pour le retour',
    };

    it('should update a customer return', async () => {
      const res = await request(app)
        .put(`/api/v1/customer-returns/${createdReturnId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);
      expect(res.status).toBe(200);
      expect(res.body.data.reason).toBe(updateData.reason);
      expect(res.body.data.notes).toBe(updateData.notes);
    });

    it('should return 404 for updating a non-existent customer return', async () => {
      const res = await request(app)
        .put('/api/v1/customer-returns/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id format', async () => {
      const res = await request(app)
        .put('/api/v1/customer-returns/abc')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /customer-returns/:id/approve', () => {
    let returnToApproveId: number;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/customer-returns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...testCustomerReturnInputNoItems,
          notes: 'Return to approve',
          returnDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
        });
      returnToApproveId = res.body.data.id;
    });

    it('should approve a customer return request', async () => {
      const res = await request(app)
        .patch(`/api/v1/customer-returns/${returnToApproveId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Approved by test' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(CustomerReturnStatus.APPROVED);
    });

    it('should return 404 for non-existent customer return', async () => {
      const res = await request(app)
        .patch('/api/v1/customer-returns/999999/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id format', async () => {
      const res = await request(app)
        .patch('/api/v1/customer-returns/abc/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /customer-returns/:id/receive', () => {
    let returnToReceiveId: number;
    let returnItemToReceiveId: number;

    beforeEach(async () => {
      const createRes = await request(app)
        .post('/api/v1/customer-returns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...testCustomerReturnInputWithItems,
          notes: 'Return to receive items',
          returnDate: dayjs().subtract(2, 'day').format('YYYY-MM-DD'),
        });
      returnToReceiveId = createRes.body.data.id;
      returnItemToReceiveId = createRes.body.data.items[0].id; // Get ID of the first item

      // Approve the return before attempting to receive items
      await request(app)
        .patch(`/api/v1/customer-returns/${returnToReceiveId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Approved for reception test' });
    });

    it('should record reception of returned items', async () => {
      const res = await request(app)
        .patch(`/api/v1/customer-returns/${returnToReceiveId}/receive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          receivedDate: dayjs().format('YYYY-MM-DD'),
          notes: 'Items received in good condition',
          items: [
            {
              id: returnItemToReceiveId,
              quantityReceived: 1,
              condition: ReturnedItemCondition.NEW,
              actionTaken: ReturnItemActionTaken.RESTOCK,
            },
          ],
        });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(CustomerReturnStatus.RECEIVED_PARTIAL); // Or RECEIVED_COMPLETE if all items are received
      expect(res.body.data.items[0].quantityReceived).toBe(1);
      expect(res.body.data.items[0].condition).toBe(ReturnedItemCondition.NEW);
      expect(res.body.data.items[0].actionTaken).toBe(ReturnItemActionTaken.RESTOCK);
    });

    it('should return 404 for non-existent customer return', async () => {
      const res = await request(app)
        .patch('/api/v1/customer-returns/999999/receive')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ items: [] });
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id format', async () => {
      const res = await request(app)
        .patch('/api/v1/customer-returns/abc/receive')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ items: [] });
      expect(res.status).toBe(400);
    });

    it('should return 400 if quantityReceived exceeds quantity to return', async () => {
      const res = await request(app)
        .patch(`/api/v1/customer-returns/${returnToReceiveId}/receive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          items: [
            {
              id: returnItemToReceiveId,
              quantityReceived: 999, // Exceeds original quantity
            },
          ],
        });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /customer-returns/:id/complete', () => {
    let returnToCompleteId: number;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/customer-returns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...testCustomerReturnInputNoItems,
          notes: 'Return to complete',
          returnDate: dayjs().subtract(3, 'day').format('YYYY-MM-DD'),
          status: CustomerReturnStatus.RECEIVED_COMPLETE, // Simulate a return ready for completion
        });
      returnToCompleteId = res.body.data.id;
    });

    it('should complete the customer return process', async () => {
      const res = await request(app)
        .post(`/api/v1/customer-returns/${returnToCompleteId}/complete`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          completionDate: dayjs().format('YYYY-MM-DD'),
          resolutionNotes: 'Refund processed',
        });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(CustomerReturnStatus.COMPLETED);
    });

    it('should return 404 for non-existent customer return', async () => {
      const res = await request(app)
        .post('/api/v1/customer-returns/999999/complete')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id format', async () => {
      const res = await request(app)
        .post('/api/v1/customer-returns/abc/complete')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /customer-returns/:id/cancel', () => {
    let returnToCancelId: number;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/customer-returns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...testCustomerReturnInputNoItems,
          notes: 'Return to cancel',
          returnDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
        });
      returnToCancelId = res.body.data.id;
    });

    it('should cancel a customer return request', async () => {
      const res = await request(app)
        .patch(`/api/v1/customer-returns/${returnToCancelId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(CustomerReturnStatus.CANCELLED);
    });

    it('should return 404 for non-existent customer return', async () => {
      const res = await request(app)
        .patch('/api/v1/customer-returns/999999/cancel')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id format', async () => {
      const res = await request(app)
        .patch('/api/v1/customer-returns/abc/cancel')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /customer-returns/:id', () => {
    let returnToDeleteId: number;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/customer-returns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...testCustomerReturnInputNoItems,
          notes: 'Return to delete',
          returnDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
        });
      returnToDeleteId = res.body.data.id;
    });

    it('should delete a customer return', async () => {
      const res = await request(app)
        .delete(`/api/v1/customer-returns/${returnToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);
    });

    it('should return 404 for deleting a non-existent customer return', async () => {
      const res = await request(app)
        .delete('/api/v1/customer-returns/999999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id format', async () => {
      const res = await request(app)
        .delete('/api/v1/customer-returns/abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });

    it('should return 400 if the return has processed financial transactions', async () => {
      const returnWithProcessedTransactionId = 3;
      const res = await request(app)
        .delete(`/api/v1/customer-returns/${returnWithProcessedTransactionId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.data).toContain(`Customer return in status 'refunded' cannot be deleted.`);
    });
  });
});

import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import app from '@/app';
import { adminToken } from '@/tests/globalSetup';
import { QuoteStatus } from '@/modules/quotes/models/quote.entity';

describe('Quote Items API (nested under Quotes)', () => {
  let testProductId1: number;
  let testProductId2: number;
  let testQuoteId: number;

  let createdQuoteItemId: number;

  const quoteItemPayload2 = {
    quantity: 1,
    unitPriceHt: 75.0,
    description: 'Item de test B pour devis',
  };

  beforeAll(async () => {
    testProductId1 = 4; // Kit Télétravail Essentiel (from quote 2 in 2-datas.sql)
    testProductId2 = 3; // Chargeur USB-C Rapide
    testQuoteId = 2; // Use existing quote ID 2

    // Ensure the quote is in DRAFT status for item modifications
    await request(app)
      .patch(`/api/v1/quotes/${testQuoteId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: QuoteStatus.DRAFT });

    // Fetch existing items for this quote to get an item ID for updates/deletions
    const getQuoteRes = await request(app)
      .get(`/api/v1/quotes/${testQuoteId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getQuoteRes.status).toBe(200);
    expect(getQuoteRes.body.data.items).toHaveLength(1);
    createdQuoteItemId = getQuoteRes.body.data.items[0].id;
  });

  describe('POST /quotes/:quoteId/items', () => {
    it('should add a new item to an existing quote', async () => {
      const item2Payload = { ...quoteItemPayload2, productId: testProductId2 };
      const res = await request(app)
        .post(`/api/v1/quotes/${testQuoteId}/items`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(item2Payload);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.quoteId).toBe(testQuoteId);
      expect(res.body.data.productId).toBe(testProductId2);
      expect(res.body.data.quantity).toBe(quoteItemPayload2.quantity);
    });

    it('should fail to add item if quote is not in DRAFT or SENT status', async () => {
      // First, change quote status to ACCEPTED
      await request(app)
        .patch(`/api/v1/quotes/${testQuoteId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: QuoteStatus.ACCEPTED });

      const item2Payload = { ...quoteItemPayload2, productId: testProductId2 };
      const res = await request(app)
        .post(`/api/v1/quotes/${testQuoteId}/items`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(item2Payload);
      expect(res.status).toBe(403); // Forbidden

      // Revert status for other tests
      await request(app)
        .patch(`/api/v1/quotes/${testQuoteId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: QuoteStatus.DRAFT });
    });

    it('should fail if product does not exist', async () => {
      const invalidItemPayload = {
        productId: 999999,
        quantity: 1,
        unitPriceHt: 10.0,
        description: 'Invalid item',
      };
      const res = await request(app)
        .post(`/api/v1/quotes/${testQuoteId}/items`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidItemPayload);
      expect(res.status).toBe(400);
    });

    it('should fail to add item with zero or negative quantity', async () => {
      const invalidItemPayload = {
        productId: testProductId1,
        quantity: 0, // Invalid quantity
        unitPriceHt: 10.0,
        description: 'Invalid quantity item',
      };
      const res = await request(app)
        .post(`/api/v1/quotes/${testQuoteId}/items`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidItemPayload);
      expect(res.status).toBe(400);
      expect(res.body.data).toContain('Quantity must be positive');
    });
  });

  describe('GET /quotes/:quoteId/items', () => {
    it('should list all items for a specific quote', async () => {
      const res = await request(app)
        .get(`/api/v1/quotes/${testQuoteId}/items`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1); // At least one item added in beforeAll
      expect(res.body.data.some((item: any) => item.id === createdQuoteItemId)).toBe(true);
    });
  });

  describe('GET /quotes/:quoteId/items/:itemId', () => {
    it('should get a specific item from a quote', async () => {
      const res = await request(app)
        .get(`/api/v1/quotes/${testQuoteId}/items/${createdQuoteItemId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(createdQuoteItemId);
      expect(res.body.data.productId).toBe(testProductId1);
    });
    it('should return 404 for non-existent itemId', async () => {
      const res = await request(app)
        .get(`/api/v1/quotes/${testQuoteId}/items/999999`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /quotes/:quoteId/items/:itemId', () => {
    const updateItemPayload = { quantity: 3, unitPriceHt: 140.0, description: 'Item A mis à jour' };
    it('should update a specific item in a quote', async () => {
      // Ensure quote is in DRAFT status before this test
      await request(app)
        .patch(`/api/v1/quotes/${testQuoteId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: QuoteStatus.DRAFT });

      const res = await request(app)
        .put(`/api/v1/quotes/${testQuoteId}/items/${createdQuoteItemId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateItemPayload);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.id).toBe(createdQuoteItemId);
      expect(res.body.data.quantity).toBe(updateItemPayload.quantity);
      expect(res.body.data.unitPriceHt).toBe(updateItemPayload.unitPriceHt);
      expect(res.body.data.description).toBe(updateItemPayload.description);
    });
  });

  describe('DELETE /quotes/:quoteId/items/:itemId', () => {
    it('should remove an item from a quote', async () => {
      // Ensure quote is in DRAFT status before this test
      await request(app)
        .patch(`/api/v1/quotes/${testQuoteId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: QuoteStatus.DRAFT });

      // Add a temporary item to delete
      const tempItemPayload = {
        ...quoteItemPayload2,
        productId: testProductId2,
        description: 'Item à supprimer',
      };
      const addRes = await request(app)
        .post(`/api/v1/quotes/${testQuoteId}/items`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(tempItemPayload);
      expect(addRes.status).toBe(201); // Ensure item is added successfully
      const tempItemId = addRes.body.data.id;

      const res = await request(app)
        .delete(`/api/v1/quotes/${testQuoteId}/items/${tempItemId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);

      // Verify it's gone
      const getRes = await request(app)
        .get(`/api/v1/quotes/${testQuoteId}/items/${tempItemId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.status).toBe(404);
    });
  });
});

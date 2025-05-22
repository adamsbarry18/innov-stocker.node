import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import app from '@/app';
import { adminToken } from '@/tests/globalSetup';
import { QuoteStatus } from '../models/quote.entity';
import dayjs from 'dayjs';

describe('Quotes API', () => {
  let testCustomerId: number;
  let testCurrencyId: number;
  let testBillingAddressId: number;
  let testShippingAddressId: number;
  let testProductId: number;
  let createdQuoteId: number;

  beforeAll(async () => {
    // Assuming these IDs exist in the seeded test database (2-datas.sql)
    testCustomerId = 1;
    testCurrencyId = 1;
    testBillingAddressId = 4;
    testShippingAddressId = 5;
    testProductId = 1;
  });

  const testQuotePayloadBase = {
    issueDate: dayjs().format('YYYY-MM-DD'),
    expiryDate: dayjs().add(30, 'day').format('YYYY-MM-DD'),
    status: QuoteStatus.DRAFT,
    notes: 'Test devis initial',
    termsAndConditions: 'Paiement à 30 jours.',
    items: [
      {
        productId: 0, // Placeholder, will be set in tests
        quantity: 2,
        unitPriceHt: 100.0,
        discountPercentage: 10,
        vatRatePercentage: 20.0,
        description: 'Item de test 1 pour devis',
      },
    ],
  };

  describe('POST /quotes', () => {
    it('should create a new quote with items ', async () => {
      const payload = {
        ...testQuotePayloadBase,
        customerId: testCustomerId,
        currencyId: testCurrencyId,
        billingAddressId: testBillingAddressId,
        shippingAddressId: testShippingAddressId,
        items: [{ ...testQuotePayloadBase.items[0], productId: testProductId }], // Use testProductId
      };
      const res = await request(app)
        .post('/api/v1/quotes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id');
      createdQuoteId = res.body.data.id;
      expect(res.body.data.customerId).toBe(testCustomerId);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].productId).toBe(testProductId);
      expect(res.body.data.totalAmountHt).toBeCloseTo(180.0); // (2 * 100 * 0.9)
    });

    it('should fail to create a quote with invalid customerId ', async () => {
      const payload = {
        ...testQuotePayloadBase,
        customerId: 999999,
        currencyId: testCurrencyId,
        billingAddressId: testBillingAddressId,
        items: [{ ...testQuotePayloadBase.items[0], productId: testProductId }], // Use testProductId
      };
      const res = await request(app)
        .post('/api/v1/quotes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should fail to create a quote without items ', async () => {
      const payload = {
        ...testQuotePayloadBase,
        items: [],
        customerId: testCustomerId,
        currencyId: testCurrencyId,
        billingAddressId: testBillingAddressId,
      };
      const res = await request(app)
        .post('/api/v1/quotes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should fail to create quote without authentication', async () => {
      const payload = {
        ...testQuotePayloadBase,
        customerId: testCustomerId,
        currencyId: testCurrencyId,
        billingAddressId: testBillingAddressId,
        items: [{ ...testQuotePayloadBase.items[0], productId: testProductId }],
      };
      const res = await request(app).post('/api/v1/quotes').send(payload);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /quotes', () => {
    it('should return a list of quotes ', async () => {
      const res = await request(app)
        .get('/api/v1/quotes?limit=5')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('quotes');
      expect(Array.isArray(res.body.data.quotes)).toBe(true);
      expect(res.body.data).toHaveProperty('total');
    });
  });

  describe('GET /quotes/:id', () => {
    it('should return a specific quote by ID ', async () => {
      const res = await request(app)
        .get(`/api/v1/quotes/${createdQuoteId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id', createdQuoteId);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items).toHaveLength(1);
    });

    it('should return 404 for a non-existent quote ID ', async () => {
      const res = await request(app)
        .get(`/api/v1/quotes/999999`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /quotes/:id', () => {
    it('should update an existing quote ', async () => {
      // First, fetch the existing quote to get item IDs if needed for precise update
      const getRes = await request(app)
        .get(`/api/v1/quotes/${createdQuoteId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      const existingQuote = getRes.body.data;

      // Ensure existingQuote and its items are valid before proceeding
      expect(existingQuote).toHaveProperty('items');
      expect(Array.isArray(existingQuote.items)).toBe(true);
      expect(existingQuote.items.length).toBeGreaterThan(0);

      const itemsToUpdate = [
        {
          id: existingQuote.items[0].id,
          productId: testProductId,
          quantity: 3,
          unitPriceHt: 95.0,
          discountPercentage: 5,
          description: 'Item modifié',
        },
        {
          productId: testProductId,
          productVariantId: null,
          quantity: 1,
          unitPriceHt: 50.0,
          description: 'Nouvel item ajouté',
        },
      ];

      const res = await request(app)
        .put(`/api/v1/quotes/${createdQuoteId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Devis mis à jour avec nouvelles conditions.', items: itemsToUpdate });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.items).toHaveLength(2);
      expect(
        res.body.data.items.find((item: any) => item.description === 'Item modifié').quantity,
      ).toBe(3);
      // Recalculate expected total based on updated items
      const expectedTotalHt = 3 * 95 * (1 - 5 / 100) + 1 * 50; // 3 * 95 * 0.95 + 50 = 270.75 + 50 = 320.75
      expect(res.body.data.totalAmountHt).toBeCloseTo(expectedTotalHt);
    });
  });

  describe('PATCH /quotes/:id/status', () => {
    it('should update quote status ', async () => {
      const res = await request(app)
        .patch(`/api/v1/quotes/${createdQuoteId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: QuoteStatus.SENT });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.status).toBe(QuoteStatus.SENT);
    });
  });

  describe('DELETE /quotes/:id', () => {
    let quoteToDeleteId: number;
    beforeAll(async () => {
      const payload = {
        ...testQuotePayloadBase,
        customerId: testCustomerId,
        currencyId: testCurrencyId,
        billingAddressId: testBillingAddressId,
        // Ensure items are included for creation
        items: [{ ...testQuotePayloadBase.items[0], productId: testProductId }],
        // quoteNumber is generated by the service, no need to set here unless testing uniqueness
        // quoteNumber: `QT-DEL-${Date.now()}`,
      };
      const res = await request(app)
        .post('/api/v1/quotes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);
      // Check if creation was successful before getting the ID
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id');
      quoteToDeleteId = res.body.data.id;
    });

    it('should soft delete a quote ', async () => {
      const res = await request(app)
        .delete(`/api/v1/quotes/${quoteToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      // The service logic throws BadRequestError if status is ACCEPTED or CONVERTED.
      // The default status is DRAFT, which should allow deletion.
      // Expecting 204 for successful deletion.
      expect(res.status).toBe(204);

      // Optional: Verify it's soft-deleted by trying to fetch it (should return 404 or indicate deleted)
      const getRes = await request(app)
        .get(`/api/v1/quotes/${quoteToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.status).toBe(404); // Assuming soft-deleted entities are not found by findById
    });
  });
});

import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import app from '@/app';
import { adminToken } from '@/tests/globalSetup';

describe('Currency API', () => {
  // Define a test currency payload
  const testCurrency = {
    code: 'TST',
    name: 'Test Currency',
    isActive: true,
    symbol: '$',
    exchangeRateToCompanyDefault: 1.0,
  };

  let createdCurrencyId: number;

  describe('POST /currencies', () => {
    it('should create a new currency (as admin)', async () => {
      const res = await request(app)
        .post('/api/v1/currencies')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testCurrency);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toMatchObject(testCurrency);
      createdCurrencyId = res.body.data.id; // Store ID for later tests

      // Verify the total count after creation
      const getRes = await request(app)
        .get('/api/v1/currencies')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.status).toBe('success');
      expect(Array.isArray(getRes.body.data.currencies)).toBe(true);
      // Assuming initial data has 2 currencies, plus the one just created
      expect(getRes.body.data.total).toBe(4);
    });

    it('should return 400 for invalid currency data (as admin)', async () => {
      const invalidCurrency = { ...testCurrency, code: '' }; // Invalid code
      const res = await request(app)
        .post('/api/v1/currencies')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidCurrency);

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('GET /currencies', () => {
    it('should return a list of currencies (as admin)', async () => {
      // Changed to admin
      const res = await request(app)
        .get('/api/v1/currencies')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data.currencies)).toBe(true);
    });

    it('should support pagination, sorting, and filtering (as admin)', async () => {
      // This is a basic test; more comprehensive tests would cover specific scenarios
      const res = await request(app)
        .get('/api/v1/currencies?page=1&limit=10&sortBy=code&order=asc&filter[isActive]=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data.currencies)).toBe(true);
      expect(res.body).toHaveProperty('meta');
      expect(res.body.meta).toHaveProperty('pagination');
      expect(res.body.meta.pagination).toHaveProperty('page', 1);
      expect(res.body.meta.pagination).toHaveProperty('limit', 10);
      expect(res.body.meta).toHaveProperty('sorting');
      expect(res.body.meta.sorting[0]).toMatchObject({ field: 'code', direction: 'ASC' });
      expect(res.body.meta).toHaveProperty('filters');
      expect(res.body.meta.filters[0]).toMatchObject({
        field: 'isActive',
        operator: 'eq',
        value: true,
      });
    });
  });

  describe('GET /currencies/:id', () => {
    it('should return a specific currency by ID (as admin)', async () => {
      // Changed to admin
      const res = await request(app)
        .get(`/api/v1/currencies/${createdCurrencyId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id', createdCurrencyId);
      expect(res.body.data).toMatchObject(testCurrency);
    });

    it('should return 404 for a non-existent currency ID (as admin)', async () => {
      const nonExistentId = 9999;
      const res = await request(app)
        .get(`/api/v1/currencies/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toBe('Not found');
    });

    it('should return 400 for an invalid currency ID format (as admin)', async () => {
      const invalidId = 'abc';
      const res = await request(app)
        .get(`/api/v1/currencies/${invalidId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toBe('Bad request');
    });
  });

  describe('PUT /currencies/:id', () => {
    const updatedCurrency = {
      code: 'UPD',
      name: 'Updated Currency',
      isActive: false,
      symbol: '$',
      exchangeRateToCompanyDefault: 1.0,
    };

    it('should update a currency by ID (as admin)', async () => {
      const res = await request(app)
        .put(`/api/v1/currencies/${createdCurrencyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedCurrency);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id', createdCurrencyId);
      expect(res.body.data).toMatchObject(updatedCurrency);
    });

    it('should return 404 for updating a non-existent currency ID (as admin)', async () => {
      const nonExistentId = 9999;
      const res = await request(app)
        .put(`/api/v1/currencies/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedCurrency);

      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toBe('Not found');
    });

    it('should return 400 for an invalid currency ID format (as admin)', async () => {
      const invalidId = 'abc';
      const res = await request(app)
        .put(`/api/v1/currencies/${invalidId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedCurrency);

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toBe('Bad request');
    });

    it('should return 400 for invalid update data (as admin)', async () => {
      const invalidUpdate = { ...updatedCurrency, code: '' }; // Invalid code
      const res = await request(app)
        .put(`/api/v1/currencies/${createdCurrencyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidUpdate);

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('DELETE /currencies/:id', () => {
    // Create a new currency specifically for deletion test
    let currencyToDeleteId: number;
    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/currencies')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'DEL',
          name: 'Delete Currency',
          isActive: true,
          symbol: 'X',
        });
      currencyToDeleteId = res.body.data.id;
    });

    it('should soft delete a currency by ID (as admin)', async () => {
      const res = await request(app)
        .delete(`/api/v1/currencies/${currencyToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
    });

    it('should return 400 if trying to delete a currency used by a company', async () => {
      // Currency ID 1 (EUR) is used as defaultCurrencyId in company 1 in 2-datas.sql
      const currencyInUseId = 1;
      const res = await request(app)
        .delete(`/api/v1/currencies/${currencyInUseId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should return 404 for deleting a non-existent currency ID (as admin)', async () => {
      const nonExistentId = 9999;
      const res = await request(app)
        .delete(`/api/v1/currencies/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toBe('Not found');
    });

    it('should return 400 for an invalid currency ID format (as admin)', async () => {
      const invalidId = 'abc';
      const res = await request(app)
        .delete(`/api/v1/currencies/${invalidId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toBe('Bad request');
    });
  });

  describe('PATCH /currencies/:id/set-default', () => {
    // Create a new currency specifically for set-default test
    let currencyToSetDefaultId: number;
    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/currencies')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'DEF',
          name: 'Default Candidate Currency',
          isActive: true,
          symbol: 'Y',
        });
      currencyToSetDefaultId = res.body.data.id;
    });

    it('should set a currency as the default company currency (as admin)', async () => {
      const res = await request(app)
        .patch(`/api/v1/currencies/${currencyToSetDefaultId}/set-default`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    it('should return 404 for setting a non-existent currency as default (as admin)', async () => {
      const nonExistentId = 9999;
      const res = await request(app)
        .patch(`/api/v1/currencies/${nonExistentId}/set-default`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toBe('Not found');
    });

    it('should return 400 for an invalid currency ID format when setting default (as admin)', async () => {
      const invalidId = 'abc';
      const res = await request(app)
        .patch(`/api/v1/currencies/${invalidId}/set-default`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toBe('Bad request');
    });
  });
});

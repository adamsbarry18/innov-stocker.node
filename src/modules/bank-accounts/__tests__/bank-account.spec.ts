import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import app from '@/app';
import { adminToken } from '@/tests/globalSetup';

describe('BankAccount API', () => {
  const testAccount = {
    accountName: 'Compte Test',
    bankName: 'Banque Test',
    accountNumber: '1234567890',
    iban: 'FR7612345678901234567890123',
    swiftBic: 'BICFRPPXXX',
    currencyId: 1,
    initialBalance: 1000.0,
  };

  let createdAccountId: number;

  describe('POST /bank-accounts', () => {
    it('should create a new bank account (as admin)', async () => {
      const res = await request(app)
        .post('/api/v1/bank-accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testAccount);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toMatchObject({
        accountName: testAccount.accountName,
        bankName: testAccount.bankName,
        iban: testAccount.iban,
        currencyId: testAccount.currencyId,
        initialBalance: testAccount.initialBalance,
      });
      createdAccountId = res.body.data.id;
    });

    it('should fail to create a bank account without authentication', async () => {
      const res = await request(app).post('/api/v1/bank-accounts').send(testAccount);
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for missing required accountName', async () => {
      const res = await request(app)
        .post('/api/v1/bank-accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...testAccount, accountName: '' });
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for missing required bankName', async () => {
      const res = await request(app)
        .post('/api/v1/bank-accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...testAccount, bankName: '' });
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for missing required currencyId', async () => {
      const { currencyId, ...partial } = testAccount;
      const res = await request(app)
        .post('/api/v1/bank-accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(partial);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for duplicate accountName', async () => {
      const res = await request(app)
        .post('/api/v1/bank-accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...testAccount, iban: 'FR7612345678901234567890999' }); // Change IBAN to avoid IBAN conflict
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for duplicate IBAN', async () => {
      const res = await request(app)
        .post('/api/v1/bank-accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...testAccount, accountName: 'Another Account' });
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('GET /bank-accounts', () => {
    it('should return a list of bank accounts (as admin)', async () => {
      const res = await request(app)
        .get('/api/v1/bank-accounts')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data.accounts)).toBe(true);
    });

    it('should fail to return bank accounts without authentication', async () => {
      const res = await request(app).get('/api/v1/bank-accounts');
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });

    it('should support pagination, sorting, and filtering', async () => {
      const res = await request(app)
        .get(
          '/api/v1/bank-accounts?page=1&limit=5&sortBy=accountName&order=asc&filter[accountName]=Compte Test',
        )
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data.accounts)).toBe(true);
      expect(res.body).toHaveProperty('meta');
      expect(res.body.meta).toHaveProperty('pagination');
      expect(res.body.meta.pagination).toHaveProperty('page', 1);
      expect(res.body.meta.pagination).toHaveProperty('limit', 5);
      expect(res.body.meta).toHaveProperty('sorting');
      expect(res.body.meta.sorting[0]).toMatchObject({ field: 'accountName', direction: 'ASC' });
      expect(res.body.meta).toHaveProperty('filters');
      expect(res.body.meta.filters[0]).toMatchObject({
        field: 'accountName',
        operator: 'eq',
        value: 'Compte Test',
      });
    });
  });

  describe('GET /bank-accounts/:id', () => {
    it('should return a specific bank account by ID (as admin)', async () => {
      const res = await request(app)
        .get(`/api/v1/bank-accounts/${createdAccountId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id', createdAccountId);
      expect(res.body.data).toMatchObject({
        accountName: testAccount.accountName,
        bankName: testAccount.bankName,
      });
    });

    it('should return 404 for a non-existent bank account ID', async () => {
      const res = await request(app)
        .get('/api/v1/bank-accounts/99999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for an invalid bank account ID format', async () => {
      const res = await request(app)
        .get('/api/v1/bank-accounts/abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should fail to get a bank account without authentication', async () => {
      const res = await request(app).get(`/api/v1/bank-accounts/${createdAccountId}`);
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('PUT /bank-accounts/:id', () => {
    const updatedAccount = {
      accountName: 'Compte Test Modifié',
      bankName: 'Banque Modifiée',
      accountNumber: '9876543210',
      iban: 'FR7612345678901234567890124',
      swiftBic: 'BICFRPPYYY',
      currencyId: 1,
    };

    it('should update a bank account by ID (as admin)', async () => {
      const res = await request(app)
        .put(`/api/v1/bank-accounts/${createdAccountId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedAccount);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id', createdAccountId);
      expect(res.body.data).toMatchObject({
        accountName: updatedAccount.accountName,
        bankName: updatedAccount.bankName,
      });
    });

    it('should return 404 for updating a non-existent bank account ID', async () => {
      const res = await request(app)
        .put('/api/v1/bank-accounts/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedAccount);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for an invalid bank account ID format', async () => {
      const res = await request(app)
        .put('/api/v1/bank-accounts/abc')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedAccount);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for invalid update data', async () => {
      const res = await request(app)
        .put(`/api/v1/bank-accounts/${createdAccountId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...updatedAccount, accountName: '' });
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should fail to update a bank account without authentication', async () => {
      const res = await request(app)
        .put(`/api/v1/bank-accounts/${createdAccountId}`)
        .send(updatedAccount);
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('DELETE /bank-accounts/:id', () => {
    let accountToDeleteId: number;
    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/bank-accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          accountName: 'Compte à Supprimer',
          bankName: 'Banque Supp',
          currencyId: 1,
          initialBalance: 0,
        });
      accountToDeleteId = res.body.data.id;
    });

    it('should soft delete a bank account by ID (as admin)', async () => {
      const res = await request(app)
        .delete(`/api/v1/bank-accounts/${accountToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);
    });

    it('should return 404 for deleting a non-existent bank account ID', async () => {
      const res = await request(app)
        .delete('/api/v1/bank-accounts/99999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for an invalid bank account ID format', async () => {
      const res = await request(app)
        .delete('/api/v1/bank-accounts/abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should fail to delete a bank account without authentication', async () => {
      const res = await request(app).delete(`/api/v1/bank-accounts/${accountToDeleteId}`);
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });
  });
});

import request from 'supertest';
import { describe, it, expect } from 'vitest';

import app from '@/app';
import { adminToken } from '@/tests/globalSetup';
import { CashRegisterTransactionType } from '../models/cash-register-transaction.entity';

describe('Cash Register Transaction API', () => {
  // IDs from src/tests/db-data/2-datas.sql
  const testSessionId = 1; // Session ouverte pour Caisse Principale Nantes
  const closedSessionId = 2; // Session fermée pour Caisse Secondaire Strasbourg
  const testUserId = 2; // user.test2@example.com
  const testPaymentMethodId = 1; // Espèces
  const testRelatedSalesOrderId = 3; // SO-2025-00003

  let createdTransactionId: number;

  const newTransactionInput = {
    cashRegisterSessionId: testSessionId,
    transactionTimestamp: '2025-06-01T10:00:00Z',
    type: CashRegisterTransactionType.CASH_IN_OTHER,
    amount: 50.0,
    description: 'Manual cash in for testing',
    paymentMethodId: testPaymentMethodId,
    relatedSalesOrderId: null, // Default to null, can be overridden
    userId: testUserId,
  };

  describe('POST /cash-register-transactions', () => {
    it('should record a new manual cash register transaction', async () => {
      const input = {
        ...newTransactionInput,
        description: 'Manual cash in for successful test',
      };
      const res = await request(app)
        .post('/api/v1/cash-register-transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(input);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.amount).toBe(input.amount);
      expect(res.body.data.type).toBe(input.type);
      expect(res.body.data.description).toBe(input.description);
      createdTransactionId = res.body.data.id;
    });

    it('should record a new manual cash register transaction linked to a sales order', async () => {
      const input = {
        ...newTransactionInput,
        description: 'Manual cash in linked to SO',
        relatedSalesOrderId: testRelatedSalesOrderId,
      };
      const res = await request(app)
        .post('/api/v1/cash-register-transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(input);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.relatedSalesOrderId).toBe(input.relatedSalesOrderId);
    });

    it('should return 400 for missing required fields', async () => {
      const invalidInput = {
        ...newTransactionInput,
        amount: undefined, // Missing amount
      };
      const res = await request(app)
        .post('/api/v1/cash-register-transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidInput);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for invalid transaction type for manual entry', async () => {
      const invalidInput = {
        ...newTransactionInput,
        type: CashRegisterTransactionType.CASH_IN_POS_SALE, // Not allowed for manual entry
      };
      const res = await request(app)
        .post('/api/v1/cash-register-transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidInput);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should return 404 if cash register session not found', async () => {
      const input = {
        ...newTransactionInput,
        cashRegisterSessionId: 99999, // Non-existent session
      };
      const res = await request(app)
        .post('/api/v1/cash-register-transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(input);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
    });

    it('should return 403 if cash register session is not open', async () => {
      const input = {
        ...newTransactionInput,
        cashRegisterSessionId: closedSessionId, // Closed session
      };
      const res = await request(app)
        .post('/api/v1/cash-register-transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(input);
      expect(res.status).toBe(403);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 if payment method not found', async () => {
      const input = {
        ...newTransactionInput,
        paymentMethodId: 99999, // Non-existent payment method
      };
      const res = await request(app)
        .post('/api/v1/cash-register-transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(input);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 if related sales order not found', async () => {
      const input = {
        ...newTransactionInput,
        relatedSalesOrderId: 99999, // Non-existent sales order
      };
      const res = await request(app)
        .post('/api/v1/cash-register-transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(input);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 if user not found', async () => {
      const input = {
        ...newTransactionInput,
        userId: 99999, // Non-existent user
      };
      const res = await request(app)
        .post('/api/v1/cash-register-transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(input);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('GET /cash-register-transactions', () => {
    it('should return a list of cash register transactions', async () => {
      const res = await request(app)
        .get('/api/v1/cash-register-transactions')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data.transactions)).toBe(true);
      expect(res.body.data.transactions.length).toBeGreaterThan(0);
    });

    it('should filter transactions by cashRegisterSessionId', async () => {
      const res = await request(app)
        .get(`/api/v1/cash-register-transactions?cashRegisterSessionId=${testSessionId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(
        res.body.data.transactions.every((t: any) => t.cashRegisterSessionId === testSessionId),
      ).toBe(true);
    });

    it('should filter transactions by type', async () => {
      const res = await request(app)
        .get(`/api/v1/cash-register-transactions?type=${CashRegisterTransactionType.CASH_IN_OTHER}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(
        res.body.data.transactions.every(
          (t: any) => t.type === CashRegisterTransactionType.CASH_IN_OTHER,
        ),
      ).toBe(true);
    });

    it('should filter transactions by userId', async () => {
      const res = await request(app)
        .get(`/api/v1/cash-register-transactions?userId=${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.transactions.every((t: any) => t.userId === testUserId)).toBe(true);
    });
  });

  describe('GET /cash-register-transactions/:id', () => {
    it('should return a specific cash register transaction by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/cash-register-transactions/${createdTransactionId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id', createdTransactionId);
      expect(res.body.data.amount).toBe(newTransactionInput.amount);
    });

    it('should return 404 for a non-existent transaction ID', async () => {
      const res = await request(app)
        .get('/api/v1/cash-register-transactions/99999999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for an invalid transaction ID format', async () => {
      const res = await request(app)
        .get('/api/v1/cash-register-transactions/abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });
  });
});

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { adminToken } from '@/tests/globalSetup';
import dayjs from 'dayjs';

// IDs from 2-datas.sql
const TEST_WAREHOUSE_ID = 1;
const TEST_SHOP_ID = 1;

const testSessionInputWarehouse = {
  warehouseId: TEST_WAREHOUSE_ID,
  shopId: null,
  startDate: dayjs().format('YYYY-MM-DD'),
  notes: 'Test inventory session for warehouse',
};

const testSessionInputShop = {
  warehouseId: null,
  shopId: TEST_SHOP_ID,
  startDate: dayjs().format('YYYY-MM-DD'),
  notes: 'Test inventory session for shop',
};

describe('InventorySessions API', () => {
  let createdSessionId: number;
  let createdSessionShopId: number;

  describe('POST /inventory-sessions', () => {
    it('should create a new inventory session for a warehouse', async () => {
      const res = await request(app)
        .post('/api/v1/inventory-sessions')
        .send(testSessionInputWarehouse)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.warehouseId).toBe(TEST_WAREHOUSE_ID);
      expect(res.body.data.shopId).toBeNull();
      expect(res.body.data.status).toBe('in_progress');
      createdSessionId = res.body.data.id;
    });

    it('should fail to create a new inventory session for a shop if one already exists', async () => {
      const res = await request(app)
        .post('/api/v1/inventory-sessions')
        .send(testSessionInputShop)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('GET /inventory-sessions', () => {
    it('should return a paginated list of inventory sessions', async () => {
      const res = await request(app)
        .get('/api/v1/inventory-sessions')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.sessions)).toBe(true);
      expect(res.body.data).toHaveProperty('total');
    });
  });

  describe('GET /inventory-sessions/:id', () => {
    it('should return an inventory session by id', async () => {
      const res = await request(app)
        .get(`/api/v1/inventory-sessions/${createdSessionId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(createdSessionId);
    });

    it('should return 404 for non-existent session', async () => {
      const res = await request(app)
        .get('/inventory-sessions/999999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /inventory-sessions/:id', () => {
    it('should update notes and dates of an inventory session', async () => {
      const updatedNotes = 'Updated notes';
      const res = await request(app)
        .put(`/api/v1/inventory-sessions/${createdSessionId}`)
        .send({ notes: updatedNotes, endDate: dayjs().add(1, 'day').format('YYYY-MM-DD') })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.notes).toBe(updatedNotes);
      expect(res.body.data.endDate).not.toBeNull();
    });

    it('should not allow updating warehouseId or shopId', async () => {
      const res = await request(app)
        .put(`/api/v1/inventory-sessions/${createdSessionId}`)
        .send({ warehouseId: 999 })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });

  describe('POST /inventory-sessions/:id/complete', () => {
    it('should complete an inventory session', async () => {
      const res = await request(app)
        .post(`/api/v1/inventory-sessions/${createdSessionId}/complete`)
        .send({ notes: 'Session completed' })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('completed');
      expect(res.body.data.notes).toContain('completed');
    });

    it('should not complete an already completed session', async () => {
      const res = await request(app)
        .post(`/api/v1/inventory-sessions/${createdSessionId}/complete`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /inventory-sessions/:id/cancel', () => {
    it('should cancel a pending/in_progress inventory session', async () => {
      // Create a new session to cancel
      const resCreate = await request(app)
        .post('/api/v1/inventory-sessions')
        .send(testSessionInputWarehouse)
        .set('Authorization', `Bearer ${adminToken}`);
      const sessionIdToCancel = resCreate.body.data.id;

      const res = await request(app)
        .patch(`/api/v1/inventory-sessions/${sessionIdToCancel}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('cancelled');
    });

    it('should not cancel a completed session', async () => {
      const res = await request(app)
        .patch(`/api/v1/inventory-sessions/${createdSessionId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(403);
    });
  });
});

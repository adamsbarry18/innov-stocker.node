import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { adminToken } from '@/tests/globalSetup';
import {
  ActionType,
  EntityType,
  type UserActivityLogApiResponse,
} from '../models/user-activity-log.entity';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

dayjs.extend(isBetween);
dayjs.extend(isSameOrBefore);

describe('UserActivityLogs API', () => {
  let createdLogId: number;
  let paginationTotal = 0;
  const userIds = [1, 2, 3, 4, 5];
  const entityIds = [uuidv4(), uuidv4(), uuidv4(), uuidv4(), uuidv4()];

  beforeAll(async () => {
    // Seed user activity logs for testing pagination and filters
    for (let i = 0; i < 30; i++) {
      await request(app)
        .post('/api/v1/user-activity-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: userIds[i % userIds.length],
          actionType: Object.values(ActionType)[i % Object.values(ActionType).length],
          entityType: Object.values(EntityType)[i % Object.values(EntityType).length],
          entityId: entityIds[i % entityIds.length],
          details: { testKey: `testValue${i}` },
          ipAddress: `192.168.1.${i % 255}`,
        });
    }
  });

  describe('POST /user-activity-logs', () => {
    it('should create a new user activity log', async () => {
      const res = await request(app)
        .post('/api/v1/user-activity-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: 1,
          actionType: ActionType.CREATE,
          entityType: EntityType.PRODUCT_MANAGEMENT,
          entityId: uuidv4(),
          details: { productId: 123, name: 'New Product' },
          ipAddress: '192.168.1.1',
        });
      createdLogId = res.body.data.id;
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.userId).toBe(1);
      expect(res.body.data.actionType).toBe(ActionType.CREATE);
      expect(res.body.data.entityType).toBe(EntityType.PRODUCT_MANAGEMENT);
    });

    it('should fail to create a log with invalid userId', async () => {
      const res = await request(app)
        .post('/api/v1/user-activity-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: -1, // Invalid userId
          actionType: ActionType.VIEW,
          entityType: EntityType.SYSTEM_UTILITY,
        });
      expect(res.status).toBe(400);
    });

    it('should fail to create a log with invalid actionType', async () => {
      const res = await request(app)
        .post('/api/v1/user-activity-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: 1,
          actionType: 'INVALID_ACTION', // Invalid actionType
          entityType: EntityType.SYSTEM_UTILITY,
        });
      expect(res.status).toBe(400);
    });

    it('should fail to create a log with invalid entityType', async () => {
      const res = await request(app)
        .post('/api/v1/user-activity-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: 1,
          actionType: ActionType.VIEW,
          entityType: 'INVALID_ENTITY', // Invalid entityType
        });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /user-activity-logs', () => {
    it('should return a paginated list of user activity logs', async () => {
      const res = await request(app)
        .get('/api/v1/user-activity-logs?limit=50') // Request a higher limit
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('logs');
      expect(Array.isArray(res.body.data.logs)).toBe(true);
      expect(res.body.data).toHaveProperty('total');
      paginationTotal = res.body.data.total;
      expect(res.body.meta).toHaveProperty('pagination'); // Ensure meta is present
      expect(res.body.meta.pagination).toHaveProperty('limit', 50);
    });

    it('should return user activity logs for partition using pagination', async () => {
      const res = await request(app)
        .get('/api/v1/user-activity-logs?page=2&limit=5')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.logs).toHaveLength(5);
      expect(res.body.meta).toHaveProperty('pagination'); // Ensure meta is present
      expect(res.body.meta.pagination).toHaveProperty('page', 2);
      expect(res.body.meta.pagination).toHaveProperty('limit', 5);
    });

    it('should filter user activity logs by userId', async () => {
      const filterUserId = userIds[0];
      const res = await request(app)
        .get(`/api/v1/user-activity-logs?userId=${filterUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(
        res.body.data.logs.every((log: UserActivityLogApiResponse) => log.userId === filterUserId),
      ).toBe(true);
    });

    it('should filter user activity logs by entityType', async () => {
      const filterEntityType = EntityType.PRODUCT_MANAGEMENT;
      const res = await request(app)
        .get(`/api/v1/user-activity-logs?entityType=${filterEntityType}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(
        res.body.data.logs.every(
          (log: UserActivityLogApiResponse) => log.entityType === filterEntityType,
        ),
      ).toBe(true);
    });

    it('should filter user activity logs by entityId', async () => {
      const filterEntityId = entityIds[0];
      const res = await request(app)
        .get(`/api/v1/user-activity-logs?entityId=${filterEntityId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(
        res.body.data.logs.every(
          (log: UserActivityLogApiResponse) => log.entityId === filterEntityId,
        ),
      ).toBe(true);
    });

    it('should sort user activity logs by userId in ascending order', async () => {
      const res = await request(app)
        .get('/api/v1/user-activity-logs?sortBy=userId&order=asc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.logs).to.be.an('array');
      let lastUserId = -1;

      // Check if userIds are in ascending order
      expect(
        res.body.data.logs.every((log: UserActivityLogApiResponse) => {
          const currentUserId = log.userId;
          const isOrdered = currentUserId >= lastUserId;
          lastUserId = currentUserId;
          return isOrdered;
        }),
      ).toBe(true);
    });
  });

  describe('GET /user-activity-logs/:id', () => {
    it('should return a user activity log by id', async () => {
      const res = await request(app)
        .get(`/api/v1/user-activity-logs/${createdLogId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id', createdLogId);
      expect(res.body.data).toHaveProperty('user'); // Should include user details
    });

    it('should return 404 for non-existent user activity log', async () => {
      const res = await request(app)
        .get('/api/v1/user-activity-logs/999999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id format', async () => {
      const res = await request(app)
        .get('/api/v1/user-activity-logs/abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });
});

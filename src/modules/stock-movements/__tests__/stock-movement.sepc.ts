import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import app from '@/app';
import { adminToken } from '@/tests/globalSetup';
import { StockMovementType } from '../models/stock-movement.entity';

describe('Stock Movements API', () => {
  // IDs from 2-datas.sql
  const testProductId = 1; // Smartphone Modèle X
  const testProductVariantId = 1; // Smartphone Modèle X - Bleu
  const testWarehouseId = 1; // Entrepôt Principal Paris Sud
  const testShopId = 1; // Boutique InnovStocker Nantes
  const testUserId = 1; // Admin Test

  let createdAdjustmentId: string;
  let createdMovementId: string; // For general movements

  beforeAll(async () => {
    // No specific setup needed here as the database is seeded before tests run
    // and we are using existing IDs.
  });

  describe('POST /stock-movements/adjustments', () => {
    it('should create a manual stock adjustment IN for a product in a warehouse', async () => {
      const payload = {
        productId: testProductId,
        warehouseId: testWarehouseId,
        movementType: StockMovementType.MANUAL_ENTRY_IN,
        quantity: 10,
        unitCostAtMovement: 350.0,
        userId: testUserId,
        notes: 'Ajustement manuel IN pour test',
      };
      const res = await request(app)
        .post('/api/v1/stock-movements/adjustments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id');
      createdAdjustmentId = res.body.data.id;
      expect(res.body.data.productId).toBe(testProductId);
      expect(res.body.data.warehouseId).toBe(testWarehouseId);
      expect(res.body.data.movementType).toBe(StockMovementType.MANUAL_ENTRY_IN);
      expect(res.body.data.quantity).toBe(10);
      expect(res.body.data.unitCostAtMovement).toBe(350.0);
    });

    it('should create a manual stock adjustment OUT for a product variant in a shop', async () => {
      const payload = {
        productId: testProductId,
        productVariantId: testProductVariantId,
        shopId: testShopId,
        movementType: StockMovementType.MANUAL_ENTRY_OUT,
        quantity: 5, // Quantity should be positive, service will convert to negative
        unitCostAtMovement: 509.99,
        userId: testUserId,
        notes: 'Ajustement manuel OUT pour test (variante)',
      };
      const res = await request(app)
        .post('/api/v1/stock-movements/adjustments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.productId).toBe(testProductId);
      expect(res.body.data.productVariantId).toBe(testProductVariantId);
      expect(res.body.data.shopId).toBe(testShopId);
      expect(res.body.data.movementType).toBe(StockMovementType.MANUAL_ENTRY_OUT);
      expect(res.body.data.quantity).toBe(-5); // Expect negative quantity
      expect(res.body.data.unitCostAtMovement).toBe(509.99);
    });

    it('should fail if movementType is not manual for adjustment endpoint', async () => {
      const payload = {
        productId: testProductId,
        warehouseId: testWarehouseId,
        movementType: StockMovementType.PURCHASE_RECEPTION, // Invalid for this endpoint
        quantity: 5,
        userId: testUserId,
      };
      const res = await request(app)
        .post('/api/v1/stock-movements/adjustments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);
      expect(res.status).toBe(400);
    });

    it('should fail if neither warehouseId nor shopId is provided', async () => {
      const payload = {
        productId: testProductId,
        movementType: StockMovementType.MANUAL_ENTRY_IN,
        quantity: 1,
        userId: testUserId,
        notes: 'Missing location',
      };
      const res = await request(app)
        .post('/api/v1/stock-movements/adjustments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);
      expect(res.status).toBe(400);
    });

    it('should fail if both warehouseId and shopId are provided', async () => {
      const payload = {
        productId: testProductId,
        warehouseId: testWarehouseId,
        shopId: testShopId,
        movementType: StockMovementType.MANUAL_ENTRY_IN,
        quantity: 1,
        userId: testUserId,
        notes: 'Both locations provided',
      };
      const res = await request(app)
        .post('/api/v1/stock-movements/adjustments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);
      expect(res.status).toBe(400);
    });

    it('should fail if product does not exist', async () => {
      const payload = {
        productId: 99999, // Non-existent product
        warehouseId: testWarehouseId,
        movementType: StockMovementType.MANUAL_ENTRY_IN,
        quantity: 1,
        userId: testUserId,
        notes: 'Non-existent product',
      };
      const res = await request(app)
        .post('/api/v1/stock-movements/adjustments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);
      expect(res.status).toBe(400);
    });

    it('should fail if product variant does not exist for the given product', async () => {
      const payload = {
        productId: testProductId,
        productVariantId: 99999, // Non-existent variant
        warehouseId: testWarehouseId,
        movementType: StockMovementType.MANUAL_ENTRY_IN,
        quantity: 1,
        userId: testUserId,
        notes: 'Non-existent variant',
      };
      const res = await request(app)
        .post('/api/v1/stock-movements/adjustments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);
      expect(res.status).toBe(400);
    });

    it('should fail if warehouse does not exist', async () => {
      const payload = {
        productId: testProductId,
        warehouseId: 99999, // Non-existent warehouse
        movementType: StockMovementType.MANUAL_ENTRY_IN,
        quantity: 1,
        userId: testUserId,
        notes: 'Non-existent warehouse',
      };
      const res = await request(app)
        .post('/api/v1/stock-movements/adjustments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);
      expect(res.status).toBe(400);
    });

    it('should fail if shop does not exist', async () => {
      const payload = {
        productId: testProductId,
        shopId: 99999, // Non-existent shop
        movementType: StockMovementType.MANUAL_ENTRY_IN,
        quantity: 1,
        userId: testUserId,
        notes: 'Non-existent shop',
      };
      const res = await request(app)
        .post('/api/v1/stock-movements/adjustments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);
      expect(res.status).toBe(400);
    });

    it('should fail to create adjustment without authentication', async () => {
      const payload = {
        productId: testProductId,
        warehouseId: testWarehouseId,
        movementType: StockMovementType.MANUAL_ENTRY_IN,
        quantity: 1,
        userId: testUserId, // User ID is set by the service based on authenticated user
        notes: 'No auth test',
      };
      const res = await request(app).post('/api/v1/stock-movements/adjustments').send(payload); // No authorization header
      expect(res.status).toBe(401);
    });
  });

  describe('GET /stock-movements/:id', () => {
    it('should return a specific stock movement by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/stock-movements/${createdAdjustmentId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.id).toBe(createdAdjustmentId);
      expect(res.body.data.movementType).toBe(StockMovementType.MANUAL_ENTRY_IN);
    });

    it('should return 404 for non-existent stock movement ID', async () => {
      const res = await request(app)
        .get(`/api/v1/stock-movements/99999999999`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid ID format', async () => {
      const res = await request(app)
        .get(`/api/v1/stock-movements/invalid-id`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });
});

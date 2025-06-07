import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import app from '@/app';
import { adminToken } from '@/tests/globalSetup';
import { PurchaseOrderStatus } from '@/modules/purchase-orders/models/purchase-order.entity';

describe('Purchase Order Items API (nested under Purchase Orders)', () => {
  // let testProductId1: number = 1; // From 2-datas.sql
  // let testProductId2: number = 2; // From 2-datas.sql
  let testPurchaseOrderId: number;
  let createdPoItemId1: number;
  let createdPoItemId2: number;

  const poItemPayloadToAdd = {
    // productId: testProductId2, // Use a valid product ID
    quantity: 3,
    unitPriceHt: 75.0,
    description: 'Item ajouté séparément',
    vatRatePercentage: 10.0,
  };

  describe('POST /purchase-orders/:orderId/items', () => {
    it('should add a new item to an existing purchase order (as user with rights)', async () => {});
  });
});

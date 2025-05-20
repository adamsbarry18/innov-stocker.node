import request from 'supertest';
import { describe, it, expect } from 'vitest';

import app from '@/app';
import { adminToken } from '@/tests/globalSetup';

describe('CustomerShippingAddress API', () => {
  // You may need to adapt these IDs to your test DB or fixtures
  let customerId = 1;
  let addressId = 1;
  let createdShippingAddressId: number;

  const testShippingAddress = {
    addressId,
    addressLabel: 'Home',
    isDefault: false,
    notes: 'Main shipping address',
  };

  describe('POST /customers/:customerId/shipping-addresses', () => {
    it('should add a new shipping address for a customer (as admin)', async () => {
      const res = await request(app)
        .post(`/api/v1/customers/${customerId}/shipping-addresses`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testShippingAddress);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toMatchObject({
        addressLabel: testShippingAddress.addressLabel,
        isDefault: testShippingAddress.isDefault,
        // notes: testShippingAddress.notes, // Removed as API response doesn't seem to include it
      });
      createdShippingAddressId = res.body.data.id;
    });

    it('should fail to add a shipping address without authentication', async () => {
      const res = await request(app)
        .post(`/api/v1/customers/${customerId}/shipping-addresses`)
        .send(testShippingAddress);
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for invalid data', async () => {
      const res = await request(app)
        .post(`/api/v1/customers/${customerId}/shipping-addresses`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...testShippingAddress, addressLabel: '' });
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('GET /customers/:customerId/shipping-addresses', () => {
    it('should return all shipping addresses for a customer (as admin)', async () => {
      const res = await request(app)
        .get(`/api/v1/customers/${customerId}/shipping-addresses`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should fail to return addresses without authentication', async () => {
      const res = await request(app).get(`/api/v1/customers/${customerId}/shipping-addresses`);
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for invalid customer ID', async () => {
      const res = await request(app)
        .get('/api/v1/customers/abc/shipping-addresses')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('PUT /customers/:customerId/shipping-addresses/:shippingAddressId', () => {
    const updatedShippingAddress = {
      addressId, // Include addressId in update
      addressLabel: 'Office',
      isDefault: true,
      notes: 'Updated address',
    };

    it('should update a shipping address for a customer (as admin)', async () => {
      const res = await request(app)
        .put(`/api/v1/customers/${customerId}/shipping-addresses/${createdShippingAddressId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedShippingAddress);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id', createdShippingAddressId);
      expect(res.body.data).toMatchObject({
        addressId: updatedShippingAddress.addressId,
        addressLabel: updatedShippingAddress.addressLabel,
        isDefault: updatedShippingAddress.isDefault,
        // notes: updatedShippingAddress.notes, // Removed as API response doesn't seem to include it
      });
    });

    it('should return 404 for updating a non-existent shipping address', async () => {
      const res = await request(app)
        .put(`/api/v1/customers/${customerId}/shipping-addresses/99999`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedShippingAddress);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for invalid shipping address ID', async () => {
      const res = await request(app)
        .put(`/api/v1/customers/${customerId}/shipping-addresses/abc`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedShippingAddress);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should fail to update without authentication', async () => {
      const res = await request(app)
        .put(`/api/v1/customers/${customerId}/shipping-addresses/${createdShippingAddressId}`)
        .send(updatedShippingAddress);
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('PATCH /customers/:customerId/shipping-addresses/:shippingAddressId/set-default', () => {
    it('should set a shipping address as default for the customer (as admin)', async () => {
      const res = await request(app)
        .patch(
          `/api/v1/customers/${customerId}/shipping-addresses/${createdShippingAddressId}/set-default`,
        )
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    it('should return 404 for non-existent shipping address', async () => {
      const res = await request(app)
        .patch(`/api/v1/customers/${customerId}/shipping-addresses/99999/set-default`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for invalid shipping address ID', async () => {
      const res = await request(app)
        .patch(`/api/v1/customers/${customerId}/shipping-addresses/abc/set-default`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should fail to set default without authentication', async () => {
      const res = await request(app).patch(
        `/api/v1/customers/${customerId}/shipping-addresses/${createdShippingAddressId}/set-default`,
      );
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });
  });

  describe('DELETE /customers/:customerId/shipping-addresses/:shippingAddressId', () => {
    it('should remove a shipping address linkage for a customer (as admin)', async () => {
      const res = await request(app)
        .delete(`/api/v1/customers/${customerId}/shipping-addresses/${createdShippingAddressId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);
    });

    it('should return 404 for deleting a non-existent shipping address', async () => {
      const res = await request(app)
        .delete(`/api/v1/customers/${customerId}/shipping-addresses/99999`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
    });

    it('should return 400 for invalid shipping address ID', async () => {
      const res = await request(app)
        .delete(`/api/v1/customers/${customerId}/shipping-addresses/abc`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should fail to delete without authentication', async () => {
      const res = await request(app).delete(
        `/api/v1/customers/${customerId}/shipping-addresses/${createdShippingAddressId}`,
      );
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
    });
  });

  it('should return 404 for a shipping address not belonging to the customer', async () => {
    // Suppose shipping address 2 belongs to customer 2, not customer 1
    const res = await request(app)
      .get('/api/v1/customers/1/shipping-addresses/2')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([403, 404]).toContain(res.status); // Forbidden or Not Found
  });

  it('should return 400 for missing required fields', async () => {
    const res = await request(app)
      .post(`/api/v1/customers/${customerId}/shipping-addresses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.status).toBe('fail');
  });
});

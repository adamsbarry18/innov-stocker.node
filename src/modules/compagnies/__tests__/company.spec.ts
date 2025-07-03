import request from 'supertest';
import { describe, it, expect } from 'vitest';

import app from '@/app';
import { adminToken } from '@/tests/globalSetup';

describe('Company API', () => {
  const existingCompanyId = 1;

  describe('GET /companies', () => {
    it('should return a list of companies (as admin)', async () => {
      const res = await request(app)
        .get('/api/v1/companies')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      if (res.body.data.length > 0) {
        const company = res.body.data[0];
        expect(company).toHaveProperty('id');
        expect(company).toHaveProperty('name');
        expect(company).toHaveProperty('email');
        expect(company).toHaveProperty('address');
        expect(company).toHaveProperty('defaultCurrency');
      }
    });
  });

  describe('GET /company/:id', () => {
    it('should return a specific company by ID (as admin)', async () => {
      const res = await request(app)
        .get(`/api/v1/company/${existingCompanyId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body).toHaveProperty('data');
      const company = res.body.data;
      expect(company).toHaveProperty('id', existingCompanyId);
      expect(company).toHaveProperty('name', 'Innov Stocker SARL');
      expect(company).toHaveProperty('email', 'contact@innovstocker.com');
      expect(company).toHaveProperty('address');
      expect(company.address).not.toBeNull();
      expect(company.address).toHaveProperty('id', 1);
      expect(company).toHaveProperty('defaultCurrency');
      expect(company.defaultCurrency).not.toBeNull();
      expect(company.defaultCurrency).toHaveProperty('id', 1);
    });

    it('should return 404 for a non-existent company ID (as admin)', async () => {
      const nonExistentId = 9999;
      const res = await request(app)
        .get(`/api/v1/company/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toBe('Not found');
    });
  });

  describe('PUT /company/:id', () => {
    const updatedName = 'Innov Stocker Updated';
    const updatedTradingName = 'IS Updated';

    afterEach(async () => {
      const originalCompany = await request(app)
        .get(`/api/v1/company/${existingCompanyId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      if (originalCompany.status === 200) {
        await request(app)
          .put(`/api/v1/company/${existingCompanyId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            ...originalCompany.body.data,
            name: 'Innov Stocker SARL',
            tradingName: 'InnovStocker',
            addressId: originalCompany.body.data.address.id,
            defaultCurrencyId: originalCompany.body.data.defaultCurrency.id,
            email: originalCompany.body.data.email,
            timezone: originalCompany.body.data.timezone,
          });
      }
    });

    it('should update a company by ID (as admin)', async () => {
      const res = await request(app)
        .put(`/api/v1/company/${existingCompanyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: updatedName,
          tradingName: updatedTradingName,
          addressId: 1,
          defaultCurrencyId: 1,
          email: 'contact.updated@innovstocker.com',
          timezone: 'Europe/Paris',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body).toHaveProperty('data');
      const company = res.body.data;
      expect(company).toHaveProperty('id', existingCompanyId);
      expect(company).toHaveProperty('name', updatedName);
      expect(company).toHaveProperty('tradingName', updatedTradingName);
      expect(company).toHaveProperty('email', 'contact.updated@innovstocker.com');
    });

    it('should return 404 for updating a non-existent company ID (as admin)', async () => {
      const nonExistentId = 9999;
      const res = await request(app)
        .put(`/api/v1/company/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Non Existent Update',
          addressId: 1,
          defaultCurrencyId: 1,
          email: 'test@test.com',
          timezone: 'Europe/Paris',
        });

      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toBe('Not found');
    });

    it('should return 400 for invalid update data (as admin)', async () => {
      const res = await request(app)
        .put(`/api/v1/company/${existingCompanyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '', // Invalid name
          addressId: 1,
          defaultCurrencyId: 1,
          email: 'invalid-email', // Invalid email
          timezone: 'Europe/Paris',
        });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toBe('Bad request');
    });
  });
});

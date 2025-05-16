import request from 'supertest';
import { beforeAll, afterAll } from 'vitest';

import { initializedApiRouter } from '@/api/index';
import app from '@/app';
import { Errors } from '@/common/errors/httpErrors';
import { appDataSource } from '@/database/data-source';
import logger from '@/lib/logger';
import { redisClient, initializeRedis } from '@/lib/redis';

export const adminCredentials = {
  email: 'user.test1@example.com',
  password: 'Password123!',
};
export let adminToken: string;

const waitFor = async (fn: () => Promise<any>, label: string, maxTries = 15, delay = 100) => {
  let tries = 0;
  while (tries < maxTries) {
    try {
      await fn();
      logger.info(`✅ ${label} is ready.`);
      return;
    } catch (err) {
      tries++;
      logger.warn(`${label} not ready, retrying in ${delay}ms... (${tries}/${maxTries}) ${err}`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  throw new Errors.ServiceUnavailableError(`${label} not ready after ${maxTries} tries`);
};

beforeAll(async () => {
  logger.info('Executing global test setup...');
  try {
    // Parallélisation de l'init DB et Redis
    await Promise.all([
      (async () => {
        if (!appDataSource.isInitialized) {
          logger.info('Initializing TypeORM DataSource for tests...');
          await appDataSource.initialize();
          logger.info('Database initialized.');
        }
      })(),
      (async () => {
        logger.info('Initializing Redis client for tests...');
        await initializeRedis();
        await waitFor(async () => {
          if (!redisClient?.isReady) throw new Errors.ServiceUnavailableError('Redis not ready');
        }, 'Redis client');
      })(),
    ]);

    // 3. API router
    logger.info('Waiting for dynamic route registration...');
    await initializedApiRouter;
    logger.info('✅ Dynamic routes registration complete.');

    // 4. Admin login
    const loginRes = await request(app).post('/api/v1/auth/login').send(adminCredentials);
    const token = loginRes.body?.data?.token;
    if (loginRes.status !== 200 || !token) {
      logger.error({ status: loginRes.status, body: loginRes.body }, 'Admin login failed');
      throw new Errors.AuthenticateError('Admin login failed in global setup');
    }
    adminToken = token;
    logger.info('✅ Admin token acquired for tests.');

    logger.info('✅ Global test setup finished successfully.');
  } catch (error) {
    logger.error(error, '❌ Error during global test setup.');
    throw error;
  }
}, 60000);

afterAll(async () => {
  logger.info('Executing global test teardown...');
  try {
    if (appDataSource.isInitialized) {
      await appDataSource.destroy();
      logger.info('✅ TypeORM DataSource destroyed.');
    }
    logger.info('🏁 Global test teardown complete.');
  } catch (error) {
    logger.error(error, '❌ Error during global test teardown.');
  }
});

import { Request, Response } from 'express';
import express from 'express';
import { initializedApiRouter } from '../dist/api/index.js';
import config from '../dist/config/index.js'; 
import logger from '../dist/lib/logger.js'; 
import { errorHandler } from '../dist/common/middleware/errorHandler.js';
import { NotFoundError } from '../dist/common/errors/httpErrors.js';
import { passportAuthenticationMiddleware } from '../dist/common/middleware/authentication.js';
import swaggerSpec from '../dist/lib/openapi.js';
import swaggerUi from 'swagger-ui-express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression'; 
import cookieParser from 'cookie-parser';
import os from 'os';
import passport from 'passport';

const app = express();
const HOSTNAME = os.hostname();

// Middleware
app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    origin: config.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }),
);
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} ${duration}ms`);
  });
  next();
});

app.use((req, res, next) => {
  res.header('X-Server', HOSTNAME);
  res.header('X-Env', config.NODE_ENV || 'development');
  res.header('X-App-Version', process.env.npm_package_version ?? 'local');
  next();
});

passportAuthenticationMiddleware();
app.use(passport.initialize());

// API Documentation (Swagger/OpenAPI)
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      defaultModelsExpandDepth: -1,
      docExpansion: 'none',
      filter: true,
    },
    customCss: '.swagger-ui .topbar { display: none }',
  }),
);

// Route racine (Health Check / Status)
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: `API is running in ${config.NODE_ENV} mode`,
    timestamp: new Date().toISOString(),
    server: HOSTNAME,
    version: process.env.npm_package_version ?? 'local',
  });
});

let routesInitialized = false;

export default async function handler(req: Request, res: Response) {
  if (!routesInitialized) {
    try {
      logger.info('Initializing API router for Vercel...');
      const apiRouter = await initializedApiRouter;
      app.use('/api/v1', apiRouter);
      
      app.use((req, res, next) => {
        next(new NotFoundError(`The requested resource was not found: ${req.method} ${req.originalUrl}`));
      });
      app.use(errorHandler);

      routesInitialized = true;
      logger.info('✅ API routes mounted successfully for Vercel.');
    } catch (error) {
      logger.fatal({ err: error }, '❌ Failed to initialize API router for Vercel. Application might not function correctly.');
      app.use('/api/v1', (req, res, next) => {
        next(new Error('API routes failed to initialize.'));
      });
      app.use(errorHandler);
    }
  }

  app(req, res);
}

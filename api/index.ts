// api/index.ts
import { Request, Response } from 'express';
import os from 'os';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import passport from 'passport';
import swaggerUi from 'swagger-ui-express';
import express from 'express';

// Imports avec chemins relatifs (résout le problème d'alias)
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { Router } from 'express';
import { glob } from 'glob';
import { registerRoutes } from '../src/common/routing/register';
import logger from '../src/lib/logger';
import { NotFoundError } from '../src/common/errors/httpErrors';
import { errorHandler } from '../src/common/middleware/errorHandler';
import { jsendMiddleware } from '../src/common/middleware/JSend';
import config from '../src/config';
import swaggerSpec from '../src/lib/openapi';
import { passportAuthenticationMiddleware } from '../src/common/middleware/authentication';

const HOSTNAME = os.hostname();

// Fonction d'initialisation des routes (copie de votre src/api/index.ts)
async function initializeApiRouter(): Promise<Router> {
  const apiRouter = Router();
  const isProd = process.env.NODE_ENV === 'production';
  const modulesPath = isProd
    ? resolve(process.cwd(), 'dist/modules')
    : resolve(process.cwd(), 'src/modules');
  const globPattern = resolve(modulesPath, `**/*.routes.${isProd ? 'js' : 'ts'}`).replace(/\\/g, '/');

  let routeFiles: string[];
  try {
    routeFiles = await glob(globPattern, { absolute: true });
  } catch (error) {
    logger.error({ err: error }, `Failed to execute glob pattern for route discovery: ${globPattern}`);
    throw new Error(`Route discovery failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (routeFiles.length === 0) {
    logger.warn(`No route files found matching pattern: ${globPattern}. API might have no routes.`);
    return apiRouter;
  }

  logger.info(`Found ${routeFiles.length} route file(s). Registering routes...`);

  const registrationPromises = routeFiles.map(async (routeFile) => {
    const relativePath = routeFile.replace(process.cwd(), '.');
    try {
      const fileURL = pathToFileURL(routeFile).toString();
      const importedModule = await import(fileURL);
      const controllerClass = importedModule.default ?? importedModule[Object.keys(importedModule)[0]];

      if (typeof controllerClass === 'function' && controllerClass.prototype) {
        registerRoutes(apiRouter, controllerClass);
      } else {
        logger.warn(`Skipping file ${relativePath}: No valid controller class found.`);
      }
    } catch (error) {
      logger.error({ err: error }, `Failed to load or register routes from file: ${relativePath}`);
      throw new Error(`Failed to process route file ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  try {
    await Promise.all(registrationPromises);
    logger.info('✅ All dynamic routes registered successfully.');
  } catch (error) {
    logger.error({ err: error }, '❌ Failed to register all dynamic routes.');
    throw error;
  }

  return apiRouter;
}

// Configuration Express (copie de votre app.ts)
const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin: config.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
app.use(compression());
app.use(cookieParser());

const bodyLimit = '5mb';
app.use(express.json({ limit: bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: bodyLimit }));
app.set('query parser', 'extended');

// Middleware de logging
app.use((req, res, next) => {
  const start = Date.now();
  const ip = req.ip ?? req.socket.remoteAddress;
  const { method, originalUrl } = req;

  res.on('finish', () => {
    if (originalUrl?.startsWith('/api-docs')) return;
    const duration = Date.now() - start;
    const { statusCode } = res;
    const logMessage = `${ip} - "${method} ${originalUrl} HTTP/${req.httpVersion}" ${statusCode} ${duration}ms`;

    if (statusCode >= 500) {
      logger.error(logMessage);
    } else if (statusCode >= 400) {
      logger.warn(logMessage);
    } else {
      logger.info(logMessage);
    }
  });
  next();
});

app.use(jsendMiddleware);

app.use((req, res, next) => {
  res.header('X-Server', HOSTNAME);
  res.header('X-Env', config.NODE_ENV || 'development');
  res.header('X-App-Version', process.env.npm_package_version ?? 'local');
  next();
});

passportAuthenticationMiddleware();
app.use(passport.initialize());

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'API Documentation',
  swaggerOptions: {
    persistAuthorization: true,
    defaultModelsExpandDepth: -1,
    docExpansion: 'none',
    filter: true,
  },
  customCss: '.swagger-ui .topbar { display: none }',
}));

// Route racine
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      message: `API is running in ${config.NODE_ENV} mode`,
      timestamp: new Date().toISOString(),
      server: HOSTNAME,
      version: process.env.npm_package_version ?? 'local',
    }
  });
});

// Variable pour stocker le router initialisé
let apiRouterInitialized = false;

// Export pour Vercel
export default async function handler(req: Request, res: Response) {
  // Initialiser les routes une seule fois
  if (!apiRouterInitialized) {
    try {
      logger.info('Initializing API router for Vercel...');
      const apiRouter = await initializeApiRouter();
      app.use('/api/v1', apiRouter);
      
      // 404 handler
      app.use((req, res, next) => {
        next(new NotFoundError(`The requested resource was not found on this server: ${req.method} ${req.originalUrl}`));
      });
      
      app.use(errorHandler);
      apiRouterInitialized = true;
      logger.info('✅ API routes mounted successfully for Vercel.');
    } catch (error) {
      logger.fatal({ err: error }, '❌ Failed to initialize API router for Vercel.');
      app.use('/api/v1', (req, res, next) => {
        next(new Error('API routes failed to initialize.'));
      });
      app.use(errorHandler);
    }
  }

  return app(req, res);
}

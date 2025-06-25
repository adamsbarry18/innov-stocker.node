import { resolve } from 'path';
import { pathToFileURL } from 'url';

import { Router } from 'express';
import { glob } from 'glob'; // Use async import

import { registerRoutes } from '../common/routing/register';
import logger from '../lib/logger';

const isProd = process.env.NODE_ENV === 'production';
const isVercel = process.env.VERCEL === '1';

// Sur Vercel, on utilise une approche simplifiée pour éviter les problèmes d'alias
const modulesPath = isProd
  ? resolve(process.cwd(), 'dist/modules')
  : resolve(process.cwd(), 'src/modules');
const globPattern = resolve(modulesPath, `**/*.routes.${isProd ? 'js' : 'ts'}`).replace(/\\/g, '/');

/**
 * Dynamically discovers and registers all routes defined in `*.routes.{ts,js}` files
 * within the `src/modules` or `dist/modules` directory.
 *
 * @returns {Promise<Router>} A promise that resolves with the Express router
 *                            containing all registered routes.
 * @throws {Error} If file searching or route registration fails.
 */
async function initializeApiRouter(): Promise<Router> {
  const apiRouter = Router();
  
  // Sur Vercel, on retourne un router vide pour éviter les problèmes d'alias
  if (isVercel) {
    logger.info('Running on Vercel - using simplified router without dynamic route loading');
    
    // Ajouter quelques routes de base pour Vercel
    apiRouter.get('/', (req, res) => {
      res.json({
        message: 'API is running on Vercel',
        status: 'ok',
        timestamp: new Date().toISOString()
      });
    });
    
    apiRouter.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString()
      });
    });
    
    return apiRouter;
  }
  
  let routeFiles: string[];
  try {
    // Use async glob
    routeFiles = await glob(globPattern, { absolute: true });
  } catch (error) {
    logger.error(
      { err: error },
      `Failed to execute glob pattern for route discovery: ${globPattern}`,
    );
    // Propagate the error as route discovery is critical
    throw new Error(
      `Route discovery failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (routeFiles.length === 0) {
    logger.warn(`No route files found matching pattern: ${globPattern}. API might have no routes.`);
    // Return the empty router if no files are found
    return apiRouter;
  }

  logger.info(`Found ${routeFiles.length} route file(s). Registering routes...`);

  const registrationPromises = routeFiles.map(async (routeFile) => {
    const relativePath = routeFile.replace(process.cwd(), '.');
    try {
      const fileURL = pathToFileURL(routeFile).toString();

      // Dynamically import the module
      const importedModule = await import(fileURL);

      // Prefer default export, otherwise take the first named export
      const controllerClass =
        importedModule.default ?? importedModule[Object.keys(importedModule)[0]];

      if (typeof controllerClass === 'function' && controllerClass.prototype) {
        controllerClass.name ?? '[Anonymous Controller]';
        registerRoutes(apiRouter, controllerClass);
      } else {
        logger.warn(
          `  Skipping file ${relativePath}: No valid controller class found as default export or first named export. Found type: ${typeof controllerClass}`,
        );
      }
    } catch (error) {
      logger.error(
        { err: error },
        `  Failed to load or register routes from file: ${relativePath}`,
      );
      // Propagate the error to fail Promise.all
      throw new Error(
        `Failed to process route file ${relativePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });

  try {
    // Wait for all imports and registrations to complete
    await Promise.all(registrationPromises);
    logger.info('✅ All dynamic routes registered successfully.');
  } catch (error) {
    logger.error({ err: error }, '❌ Failed to register all dynamic routes.');
    // Propagate the global error if any registration failed
    throw error;
  }

  return apiRouter;
}

// Export the promise that will resolve with the router once it's ready.
// Consumers (app.ts, tests) MUST await this promise.
export const initializedApiRouter: Promise<Router> = initializeApiRouter();

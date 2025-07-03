import { ZodError } from 'zod';

import config from '@/config';
import logger from '@/lib/logger';

import { type Request, type Response, type NextFunction } from '../../config/http';
import { BaseError, ServerError, ValidationError } from '../errors/httpErrors';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  let error: BaseError;

  // Detailed error log, even in production
  if (config.NODE_ENV === 'production') {
    try {
      // Use logger serialization for safe error logging
      logger.error({
        type: 'API_ERROR_DETAIL',
        error: err,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
      });
    } catch (e) {
      // Fallback to console if logger fails
      // eslint-disable-next-line no-console
      console.error('API error detail (fallback):', err);
    }
  } else {
    // In development, log everything including body and query
    logger.error({
      type: 'API_ERROR_DETAIL',
      error: err,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      body: req.body,
      query: req.query,
    });
  }

  // Construction de l'objet d'erreur pour la réponse
  if (err instanceof ZodError) {
    error = new ValidationError(err.errors.map((e) => e.message));
  } else if (err instanceof BaseError) {
    error = err;
  } else {
    error = new ServerError('An unexpected error occurred');
  }

  const message =
    config.NODE_ENV === 'production' && error.status >= 500
      ? 'Internal Server Error'
      : error.message;

  const errorPayload: Record<string, any> = {
    message: message,
    code: error.code,
    data:
      error instanceof ValidationError || config.NODE_ENV !== 'production' ? error.data : undefined,
    stack: config.NODE_ENV !== 'production' ? error.stack : undefined,
  };

  Object.keys(errorPayload).forEach((key) => {
    if (errorPayload[key] === undefined) {
      delete errorPayload[key];
    }
  });

  const jsendStatus = error.status >= 500 ? 'error' : 'fail';

  res.status(error.status).json({
    status: jsendStatus,
    ...errorPayload,
  });
};

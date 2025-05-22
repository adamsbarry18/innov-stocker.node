import pino from 'pino';
import config from '../config';

// Only log essential info in test mode
const isTest = config.NODE_ENV === 'test';

const logger = pino({
  level: isTest ? 'debug' : config.LOG_LEVEL || 'info',
  transport:
    config.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:dd-mm-yyyy HH:MM:ss',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  hooks: isTest
    ? {
        logMethod(args, method) {
          // Only log errors, warnings, and debug in test mode, and filter out noisy logs
          const [msgOrObj, ...rest] = args;
          // Filter out repetitive/verbose logs in test mode
          if (
            typeof msgOrObj === 'string' &&
            (msgOrObj.includes('Initializing shared connections') ||
              msgOrObj.includes('Waiting for API router initialization') ||
              msgOrObj.includes('API router initialized') ||
              msgOrObj.includes('Registering routes from') ||
              msgOrObj.includes('All dynamic routes registered successfully') ||
              msgOrObj.includes('Mailer is ready to send emails.') ||
              (msgOrObj.includes('Found') && msgOrObj.includes('route file')))
          ) {
            return;
          }
          // Only log if method is debug, warn, error, or fatal
          if (
            method.name === 'debug' ||
            method.name === 'warn' ||
            method.name === 'error' ||
            method.name === 'fatal'
          ) {
            method.apply(this, args);
          }
        },
      }
    : undefined,
});

export default logger;

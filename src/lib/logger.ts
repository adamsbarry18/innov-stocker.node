export interface Logger {
  info: (message?: any, ...optionalParams: any[]) => void;
  log: (message?: any, ...optionalParams: any[]) => void;
  warn: (message?: any, ...optionalParams: any[]) => void;
  debug: (message?: any, ...optionalParams: any[]) => void;
  error: (message?: any, ...optionalParams: any[]) => void;
  fatal: (message?: any, ...optionalParams: any[]) => void;
}

class ConsoleLogger implements Logger {
  private logs: { level: string; message: any; optionalParams: any[] }[] = [];
  private isMuted: boolean = process.env.NODE_ENV === 'test';

  private safeSerialize(obj: any): string {
    if (typeof obj === 'string') return obj;
    try {
      return JSON.stringify(
        obj,
        (key, value) => {
          // Remove functions and symbols from serialization
          if (typeof value === 'function' || typeof value === 'symbol') {
            return undefined;
          }
          return value;
        },
        2,
      );
    } catch (e) {
      return '[Unserializable object]';
    }
  }

  private passthrough(level: string, message: any): string {
    if (typeof message === 'object') {
      return this.safeSerialize(message);
    }
    return message;
  }

  private captureLog(level: string, message?: any, optionalParams: any[] = []): void {
    this.logs.push({ level, message, optionalParams });
    if (this.isMuted) return; // Do not output logs in test environment
    const plainMessage = this.passthrough(level, message);
    switch (level) {
      case 'info':
        console.info(plainMessage, ...optionalParams);
        break;
      case 'log':
        console.log(plainMessage, ...optionalParams);
        break;
      case 'warn':
        console.warn(plainMessage, ...optionalParams);
        break;
      case 'debug':
        console.debug(plainMessage, ...optionalParams);
        break;
      case 'error':
      case 'fatal':
        console.error(plainMessage, ...optionalParams);
        break;
    }
  }

  info(message?: any, ...optionalParams: any[]): void {
    this.captureLog('info', message, optionalParams);
  }

  log(message?: any, ...optionalParams: any[]): void {
    this.captureLog('log', message, optionalParams);
  }

  warn(message?: any, ...optionalParams: any[]): void {
    this.captureLog('warn', message, optionalParams);
  }

  debug(message?: any, ...optionalParams: any[]): void {
    this.captureLog('debug', message, optionalParams);
  }

  error(message?: any, ...optionalParams: any[]): void {
    this.captureLog('error', message, optionalParams);
  }

  fatal(message?: any, ...optionalParams: any[]): void {
    this.captureLog('fatal', message, optionalParams);
  }

  getLogs(): { level: string; message: any; optionalParams: any[] }[] {
    return this.logs;
  }

  clearLogs(): void {
    this.logs = [];
  }
}

const logger: Logger & {
  getLogs: () => any[];
  clearLogs: () => void;
} = new ConsoleLogger();

export default logger;

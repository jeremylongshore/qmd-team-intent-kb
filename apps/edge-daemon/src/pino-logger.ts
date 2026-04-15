import pino from 'pino';
import type { DaemonLogger } from './types.js';

function buildPino(): pino.Logger {
  const pretty = process.env['DAEMON_LOG_PRETTY'] === '1';
  if (pretty) {
    return pino({
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    });
  }
  return pino();
}

/**
 * Pino-backed structured logger that satisfies DaemonLogger.
 *
 * JSON lines include `time`, `level`, `msg` by default. Bind a `tenantId`
 * via `child({ tenantId })` so all log lines in a given tenant scope carry
 * the field automatically.
 */
export class PinoDaemonLogger implements DaemonLogger {
  private readonly logger: pino.Logger;

  constructor(pinoInstance?: pino.Logger) {
    this.logger = pinoInstance ?? buildPino();
  }

  /** Return a child logger with additional bound fields (e.g. `{ tenantId }`). */
  child(bindings: Record<string, unknown>): PinoDaemonLogger {
    return new PinoDaemonLogger(this.logger.child(bindings));
  }

  info(message: string): void {
    this.logger.info(message);
  }

  warn(message: string): void {
    this.logger.warn(message);
  }

  error(message: string): void {
    this.logger.error(message);
  }
}

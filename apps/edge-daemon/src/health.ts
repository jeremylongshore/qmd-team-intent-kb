import type { DaemonLogger } from './types.js';

/** Console-based logger for the daemon */
export class ConsoleDaemonLogger implements DaemonLogger {
  private readonly prefix: string;

  constructor(prefix = '[edge-daemon]') {
    this.prefix = prefix;
  }

  info(message: string): void {
    console.log(`${this.prefix} ${message}`);
  }

  warn(message: string): void {
    console.warn(`${this.prefix} WARN: ${message}`);
  }

  error(message: string): void {
    console.error(`${this.prefix} ERROR: ${message}`);
  }
}

/** Silent logger for tests */
export class NullLogger implements DaemonLogger {
  info(_message: string): void {
    /* noop */
  }
  warn(_message: string): void {
    /* noop */
  }
  error(_message: string): void {
    /* noop */
  }
}

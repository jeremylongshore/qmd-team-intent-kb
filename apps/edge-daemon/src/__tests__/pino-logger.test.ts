import { describe, it, expect } from 'vitest';
import pino from 'pino';
import { PinoDaemonLogger } from '../pino-logger.js';

/** Base shape of every pino JSON log line */
interface PinoLogEntry {
  time: number;
  level: number;
  msg: string;
  tenantId?: string;
}

function makeCapturingLogger(): { logger: PinoDaemonLogger; lines: () => PinoLogEntry[] } {
  const captured: string[] = [];

  const pinoInstance = pino(
    { level: 'trace' },
    {
      write(line: string) {
        captured.push(line);
      },
    },
  );

  const logger = new PinoDaemonLogger(pinoInstance);
  return {
    logger,
    lines: () => captured.map((l) => JSON.parse(l) as PinoLogEntry),
  };
}

describe('PinoDaemonLogger', () => {
  it('emits a JSON line with time, level, and msg for info()', () => {
    const { logger, lines } = makeCapturingLogger();
    logger.info('hello world');
    const [entry] = lines();
    expect(entry).toBeDefined();
    expect(typeof entry!.time).toBe('number');
    expect(entry!.level).toBe(30); // pino info level
    expect(entry!.msg).toBe('hello world');
  });

  it('emits correct level codes for warn and error', () => {
    const { logger, lines } = makeCapturingLogger();
    logger.warn('be careful');
    logger.error('something broke');
    const entries = lines();
    expect(entries[0]!.level).toBe(40); // warn
    expect(entries[1]!.level).toBe(50); // error
  });

  it('child() binds tenantId to every subsequent log line', () => {
    const { logger, lines } = makeCapturingLogger();
    const child = logger.child({ tenantId: 'team-alpha' });
    child.info('scoped message');
    const [entry] = lines();
    expect(entry!.tenantId).toBe('team-alpha');
    expect(entry!.msg).toBe('scoped message');
  });

  it('child() returns a PinoDaemonLogger instance', () => {
    const { logger } = makeCapturingLogger();
    const child = logger.child({ tenantId: 'team-beta' });
    expect(child).toBeInstanceOf(PinoDaemonLogger);
  });

  it('parent logger lines do not include child bindings', () => {
    const { logger, lines } = makeCapturingLogger();
    const child = logger.child({ tenantId: 'scoped' });
    logger.info('parent line');
    child.info('child line');
    const entries = lines();
    expect(entries[0]!.tenantId).toBeUndefined();
    expect(entries[1]!.tenantId).toBe('scoped');
  });
});

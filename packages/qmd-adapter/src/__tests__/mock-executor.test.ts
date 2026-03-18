import { describe, it, expect, beforeEach } from 'vitest';
import { MockQmdExecutor } from '../executor/mock-executor.js';

describe('MockQmdExecutor', () => {
  let mock: MockQmdExecutor;

  beforeEach(() => {
    mock = new MockQmdExecutor();
  });

  it('records executed commands', async () => {
    mock.queueSuccess('ok');
    await mock.execute(['search', 'test']);
    expect(mock.commands).toHaveLength(1);
    expect(mock.commands[0]).toEqual(['search', 'test']);
  });

  it('returns queued responses in order', async () => {
    mock.queueSuccess('first');
    mock.queueSuccess('second');

    const r1 = await mock.execute(['cmd1']);
    const r2 = await mock.execute(['cmd2']);
    expect(r1.stdout).toBe('first');
    expect(r2.stdout).toBe('second');
  });

  it('returns failure when no response queued', async () => {
    const result = await mock.execute(['anything']);
    expect(result.exitCode).toBe(1);
  });

  it('queueFailure sets stderr and exitCode', async () => {
    mock.queueFailure('bad command', 2);
    const result = await mock.execute(['bad']);
    expect(result.stderr).toBe('bad command');
    expect(result.exitCode).toBe(2);
  });

  it('isAvailable reflects setAvailable', async () => {
    expect(await mock.isAvailable()).toBe(true);
    mock.setAvailable(false);
    expect(await mock.isAvailable()).toBe(false);
  });

  it('lastCommand returns most recent command', async () => {
    mock.queueSuccess('a');
    mock.queueSuccess('b');
    await mock.execute(['first']);
    await mock.execute(['second', 'arg']);
    expect(mock.lastCommand).toEqual(['second', 'arg']);
  });

  it('reset clears all state', async () => {
    mock.queueSuccess('ok');
    await mock.execute(['test']);
    mock.setAvailable(false);
    mock.reset();

    expect(mock.commands).toHaveLength(0);
    expect(await mock.isAvailable()).toBe(true);
  });
});

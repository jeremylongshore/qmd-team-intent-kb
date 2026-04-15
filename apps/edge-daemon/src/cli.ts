import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import type { DaemonConfig, DaemonDependencies, DaemonLogger } from './types.js';
import { isLocked } from './lock.js';
import { EdgeDaemon } from './daemon.js';
import { runCycle } from './cycle.js';

export type Subcommand = 'start' | 'stop' | 'status' | 'run-once';

export interface CliDeps {
  config: DaemonConfig;
  daemonDeps: DaemonDependencies;
  logger: DaemonLogger;
}

const USAGE = `Usage: edge-daemon <subcommand>

Subcommands:
  start     Start the daemon (default if no subcommand given)
  stop      Send SIGTERM to the running daemon and exit
  status    Print daemon status as JSON and exit
  run-once  Run exactly one cycle and exit
`;

function readPid(pidFilePath: string): number | null {
  if (!existsSync(pidFilePath)) return null;
  try {
    const content = readFileSync(pidFilePath, 'utf8').trim();
    const pid = parseInt(content, 10);
    return Number.isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

async function cmdStart(deps: CliDeps): Promise<number> {
  const daemon = new EdgeDaemon(deps.config, deps.daemonDeps, deps.logger);
  try {
    await daemon.bootstrap();
    daemon.start();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    deps.logger.error(msg);
    return 1;
  }
  return 0;
}

async function cmdStop(deps: CliDeps): Promise<number> {
  const pid = readPid(deps.config.pidFilePath);

  if (pid === null) {
    process.stderr.write('edge-daemon: no lock file found — daemon is not running\n');
    return 1;
  }

  const running = isLocked(deps.config.pidFilePath);

  if (!running) {
    // Stale lock: the PID is recorded but the process is gone. Clean up and treat as stopped.
    unlinkSync(deps.config.pidFilePath);
    process.stderr.write('edge-daemon: stale lock file removed — daemon was not running\n');
    return 0;
  }

  try {
    process.kill(pid, 'SIGTERM');
    return 0;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(`edge-daemon: failed to send SIGTERM to PID ${pid}: ${msg}\n`);
    return 1;
  }
}

async function cmdStatus(deps: CliDeps): Promise<number> {
  const pid = readPid(deps.config.pidFilePath);

  if (pid === null) {
    process.stdout.write(JSON.stringify({ status: 'stopped' }) + '\n');
    return 0;
  }

  const running = isLocked(deps.config.pidFilePath);
  if (!running) {
    process.stdout.write(JSON.stringify({ status: 'stopped', staleLockPid: pid }) + '\n');
    return 0;
  }

  process.stdout.write(JSON.stringify({ status: 'running', pid }) + '\n');
  return 0;
}

async function cmdRunOnce(deps: CliDeps): Promise<number> {
  try {
    await runCycle(deps.config, deps.daemonDeps, deps.logger);
    return 0;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    deps.logger.error(`run-once failed: ${msg}`);
    return 1;
  }
}

/**
 * Dispatch a CLI subcommand. Returns an exit code.
 *
 * Default subcommand (no argument) is `start` — daemon invocations are almost
 * always meant to start the long-running loop, so requiring an explicit flag
 * would add unnecessary friction for the primary use case.
 */
export async function dispatch(argv: string[], deps: CliDeps): Promise<number> {
  const subcommand = argv[0] ?? 'start';

  switch (subcommand) {
    case 'start':
      return cmdStart(deps);
    case 'stop':
      return cmdStop(deps);
    case 'status':
      return cmdStatus(deps);
    case 'run-once':
      return cmdRunOnce(deps);
    default:
      process.stderr.write(`edge-daemon: unknown subcommand '${subcommand}'\n\n${USAGE}`);
      return 1;
  }
}

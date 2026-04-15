import type {
  DaemonConfig,
  DaemonDependencies,
  DaemonState,
  CycleResult,
  DaemonLogger,
} from './types.js';
import { acquireLock, releaseLock } from './lock.js';
import { runCycle } from './cycle.js';
import { HealthServer } from './health-server.js';

/**
 * Edge Daemon — polls the spool directory, runs curation, and syncs the index.
 *
 * Lifecycle:
 *   start() → acquires PID lock → enters polling loop
 *   stop()  → sets state to 'stopping' → waits for in-flight cycle → releases lock
 *
 * Signal handlers for SIGTERM/SIGINT trigger graceful shutdown.
 */
export class EdgeDaemon {
  private _state: DaemonState = 'idle';
  private _lastCycleResult: CycleResult | null = null;
  private _timer: ReturnType<typeof setTimeout> | null = null;
  private _cycleInFlight = false;
  private _stopResolve: (() => void) | null = null;
  private readonly _signalHandlers: Array<{ signal: NodeJS.Signals; handler: () => void }> = [];
  private _healthServer: HealthServer | null = null;
  private _healthServerStartPromise: Promise<void> | null = null;

  constructor(
    private readonly config: DaemonConfig,
    private readonly deps: DaemonDependencies,
    private readonly logger: DaemonLogger,
  ) {}

  get state(): DaemonState {
    return this._state;
  }

  get lastCycleResult(): CycleResult | null {
    return this._lastCycleResult;
  }

  /**
   * Start the daemon. Acquires PID lock and begins polling.
   *
   * @throws Error if the lock cannot be acquired (another instance running).
   */
  start(): void {
    if (this._state !== 'idle') {
      throw new Error(`Cannot start daemon in state '${this._state}'`);
    }

    const locked = acquireLock(this.config.pidFilePath);
    if (!locked) {
      throw new Error(
        `Cannot acquire lock — another daemon instance holds ${this.config.pidFilePath}`,
      );
    }

    this._state = 'running';

    if ((this.config.healthPort ?? 0) > 0) {
      this._healthServer = new HealthServer({
        port: this.config.healthPort!,
        host: this.config.healthHost,
        getState: () => this._state,
        getLastCycleResult: () => this._lastCycleResult,
      });
      this._healthServerStartPromise = this._healthServer
        .start()
        .then(() => this.logger.info(`Health server listening on port ${this._healthServer!.port}`))
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(`Health server failed to start: ${msg}`);
        })
        .finally(() => {
          this._healthServerStartPromise = null;
        });
    }

    this.registerSignalHandlers();
    this.logger.info(
      `Daemon started (tenant=${this.config.tenantId}, poll=${this.config.pollIntervalMs}ms)`,
    );
    this.scheduleCycle();
  }

  /**
   * Stop the daemon gracefully.
   *
   * Cancels the pending timer, waits for any in-flight cycle to complete,
   * releases the PID lock, and transitions to 'stopped'.
   */
  async stop(): Promise<void> {
    if (this._state !== 'running' && this._state !== 'stopping') {
      return;
    }

    this._state = 'stopping';
    this.logger.info('Daemon stopping...');

    // Cancel pending timer
    if (this._timer !== null) {
      clearTimeout(this._timer);
      this._timer = null;
    }

    // Wait for in-flight cycle
    if (this._cycleInFlight) {
      await new Promise<void>((resolve) => {
        this._stopResolve = resolve;
      });
    }

    this.removeSignalHandlers();

    if (this._healthServer !== null) {
      // Await any in-flight start() before stopping — prevents the race where stop()
      // calls _healthServer.stop() while _server is still null (start() not yet resolved),
      // which would cause stop() to return early and leave the http.Server running forever.
      if (this._healthServerStartPromise !== null) {
        await this._healthServerStartPromise;
      }
      await this._healthServer.stop();
      this._healthServer = null;
    }

    releaseLock(this.config.pidFilePath);
    this._state = 'stopped';
    this.logger.info('Daemon stopped');
  }

  private scheduleCycle(): void {
    if (this._state !== 'running') return;

    this._timer = setTimeout(() => {
      void this.executeCycle();
    }, this.config.pollIntervalMs);
  }

  private async executeCycle(): Promise<void> {
    if (this._state !== 'running') return;

    this._cycleInFlight = true;
    try {
      this._lastCycleResult = await runCycle(this.config, this.deps, this.logger);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Cycle failed: ${msg}`);
    } finally {
      this._cycleInFlight = false;

      // If stop() is waiting, resolve its promise
      if (this._stopResolve) {
        this._stopResolve();
        this._stopResolve = null;
      }
    }

    // Schedule next cycle if still running
    this.scheduleCycle();
  }

  /**
   * Execute a single cycle immediately (for testing and manual triggers).
   * Does not affect the polling schedule.
   */
  async runOnce(): Promise<CycleResult> {
    this._cycleInFlight = true;
    try {
      const result = await runCycle(this.config, this.deps, this.logger);
      this._lastCycleResult = result;
      return result;
    } finally {
      this._cycleInFlight = false;
    }
  }

  private registerSignalHandlers(): void {
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
    for (const signal of signals) {
      const handler = (): void => {
        void this.stop();
      };
      process.on(signal, handler);
      this._signalHandlers.push({ signal, handler });
    }
  }

  private removeSignalHandlers(): void {
    for (const { signal, handler } of this._signalHandlers) {
      process.removeListener(signal, handler);
    }
    this._signalHandlers.length = 0;
  }
}

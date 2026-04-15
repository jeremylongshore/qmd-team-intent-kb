import { createServer, type Server } from 'node:http';
import type { CycleResult, DaemonState } from './types.js';

export interface HealthServerOptions {
  port: number;
  /** Host/address to bind to. Default '127.0.0.1'. Pass '0.0.0.0' inside Docker/Kubernetes. */
  host?: string;
  getState: () => DaemonState;
  getLastCycleResult: () => CycleResult | null;
}

export class HealthServer {
  private readonly _options: HealthServerOptions;
  private _server: Server | null = null;
  private _assignedPort = 0;

  constructor(options: HealthServerOptions) {
    this._options = options;
  }

  get port(): number {
    return this._assignedPort;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = createServer((req, res) => {
        const url = req.url ?? '/';

        if (url === '/healthz') {
          const state = this._options.getState();
          const stopping = state === 'stopping';
          const statusCode = stopping ? 503 : 200;
          const body = JSON.stringify({ status: stopping ? 'stopping' : 'ok' });
          res.writeHead(statusCode, { 'Content-Type': 'application/json' });
          res.end(body);
          return;
        }

        if (url === '/last-cycle') {
          const result = this._options.getLastCycleResult();
          if (result === null) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'no cycle has run' }));
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result, null, 2));
          }
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
      });

      server.once('error', reject);

      server.listen(this._options.port, this._options.host ?? '127.0.0.1', () => {
        const addr = server.address();
        this._assignedPort =
          typeof addr === 'object' && addr !== null ? addr.port : this._options.port;
        this._server = server;
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._server === null) {
        resolve();
        return;
      }
      this._server.close((err) => {
        if (err) {
          reject(err);
        } else {
          this._server = null;
          resolve();
        }
      });
    });
  }
}

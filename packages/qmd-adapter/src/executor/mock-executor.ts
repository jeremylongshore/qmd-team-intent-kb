import type { QmdExecutor } from './executor.js';
import type { CommandResult } from '../types.js';

/** Mock executor for testing — queues responses and records commands */
export class MockQmdExecutor implements QmdExecutor {
  readonly commands: string[][] = [];
  private responses: CommandResult[] = [];
  private _available = true;

  /** Queue a response for the next execute() call */
  queueResponse(response: CommandResult): void {
    this.responses.push(response);
  }

  /** Queue a success response */
  queueSuccess(stdout: string): void {
    this.responses.push({ stdout, stderr: '', exitCode: 0 });
  }

  /** Queue a failure response */
  queueFailure(stderr: string, exitCode = 1): void {
    this.responses.push({ stdout: '', stderr, exitCode });
  }

  /** Set whether qmd appears available */
  setAvailable(available: boolean): void {
    this._available = available;
  }

  async execute(args: string[]): Promise<CommandResult> {
    this.commands.push(args);
    const response = this.responses.shift();
    if (!response) {
      return { stdout: '', stderr: 'No mock response queued', exitCode: 1 };
    }
    return response;
  }

  async isAvailable(): Promise<boolean> {
    return this._available;
  }

  /** Get the last command that was executed */
  get lastCommand(): string[] | undefined {
    return this.commands[this.commands.length - 1];
  }

  /** Reset all state */
  reset(): void {
    this.commands.length = 0;
    this.responses.length = 0;
    this._available = true;
  }
}

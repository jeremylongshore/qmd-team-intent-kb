import type { CommandResult } from '../types.js';

/** Interface for executing qmd CLI commands */
export interface QmdExecutor {
  execute(args: string[]): Promise<CommandResult>;
  isAvailable(): Promise<boolean>;
}

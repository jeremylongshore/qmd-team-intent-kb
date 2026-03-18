/** Error from a qmd operation */
export interface QmdError {
  code: 'not_available' | 'not_initialized' | 'command_failed' | 'parse_error' | 'timeout';
  message: string;
  command?: string;
  stderr?: string;
}

/** Result of executing a qmd CLI command */
export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** Health status of the qmd installation and index */
export interface QmdHealthStatus {
  available: boolean;
  version: string | null;
  initialized: boolean;
  collections: string[];
}

/** A single search result from qmd */
export interface QmdSearchResult {
  file: string;
  score: number;
  snippet: string;
  collection: string;
}

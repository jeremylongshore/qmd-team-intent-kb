export type { CurationResult, CurationBatchResult, CuratorConfig } from './types.js';
export { Curator } from './curator.js';
export type { CuratorDependencies } from './curator.js';
export { ingestFromSpool } from './intake/spool-intake.js';
export { checkDuplicate } from './dedup/dedup-checker.js';
export type { DedupResult } from './dedup/dedup-checker.js';
export {
  detectSupersession,
  computeTitleSimilarity,
} from './supersession/supersession-detector.js';
export type { SupersessionMatch } from './supersession/supersession-detector.js';
export { promote } from './promotion/promoter.js';
export type { PromotionInput } from './promotion/promoter.js';
export { reject } from './rejection/rejector.js';
export { parseMarkdown, titleFromPath, walkVault, countVaultFiles } from './import/index.js';
export type { ParsedMarkdown, VaultFile } from './import/index.js';

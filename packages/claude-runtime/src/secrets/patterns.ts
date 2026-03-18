import type { SecretPattern } from '../types.js';

/** Named secret detection patterns for v1 */
export const SECRET_PATTERNS: SecretPattern[] = [
  {
    id: 'jwt',
    name: 'JWT Token',
    regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
    description: 'JSON Web Token (three base64url segments)',
  },
  {
    id: 'aws-key',
    name: 'AWS Access Key',
    regex: /AKIA[0-9A-Z]{16}/,
    description: 'AWS IAM access key ID',
  },
  {
    id: 'github-token',
    name: 'GitHub Token',
    regex: /gh[pousr]_[A-Za-z0-9_]{36,}/,
    description: 'GitHub personal access token, OAuth, or app token',
  },
  {
    id: 'generic-api-key',
    name: 'Generic API Key (sk-*)',
    regex: /sk-[A-Za-z0-9]{20,}/,
    description: 'API key with sk- prefix (OpenAI, Stripe, etc.)',
  },
  {
    id: 'slack-token',
    name: 'Slack Token',
    regex: /xox[bpras]-[0-9A-Za-z-]{10,}/,
    description: 'Slack bot, user, or app token',
  },
  {
    id: 'pem-key',
    name: 'PEM Private Key',
    regex: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/,
    description: 'PEM-encoded private key header',
  },
  {
    id: 'connection-string',
    name: 'Connection String with Credentials',
    regex: /(?:mongodb|postgres|mysql|redis|amqp):\/\/[^:]+:[^@]+@/,
    description: 'Database or service connection string with embedded credentials',
  },
  {
    id: 'base64-auth',
    name: 'Base64 Authorization Header',
    regex: /Basic\s+[A-Za-z0-9+/]{20,}={0,2}/,
    description: 'HTTP Basic auth header with Base64-encoded credentials',
  },
  {
    id: 'gcp-service-account',
    name: 'GCP Service Account JSON',
    regex: /"type"\s*:\s*"service_account"/,
    description: 'Google Cloud service account key file marker',
  },
  {
    id: 'high-entropy-hex',
    name: 'High-Entropy Hex String',
    regex: /[a-f0-9]{40,}/,
    description: 'Long hex string that may be a secret key or hash (40+ chars)',
  },
  {
    id: 'env-secret',
    name: 'Environment Variable Secret',
    regex: /(?:SECRET|PASSWORD|TOKEN|API_KEY|PRIVATE_KEY)\s*=\s*["']?[^\s"']{8,}/i,
    description: 'Environment variable assignment containing a secret value',
  },
];

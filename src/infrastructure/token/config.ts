import type { TokenConfig } from "../../domain/token";

const MIN_SECRET_BYTES = 32;

const EXPIRES_IN_PATTERN =
  /^-?\d+\s*(?:seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)(?:\s+(?:from\s+now|ago))?$/i;

function readRequiredEnv(env: NodeJS.ProcessEnv, name: string): string {
  const raw = env[name];
  if (raw === undefined || raw.trim() === "") {
    throw new Error(`${name} is required`);
  }
  return raw.trim();
}

function validateSecretLength(secret: string): string {
  if (Buffer.byteLength(secret, "utf8") < MIN_SECRET_BYTES) {
    throw new Error(`JWT_SECRET must be at least ${MIN_SECRET_BYTES} bytes`);
  }
  return secret;
}

function isValidExpiresIn(value: string): boolean {
  return EXPIRES_IN_PATTERN.test(value) || /^-?\d+$/.test(value);
}

function normalizeExpiresIn(value: string): string {
  if (/^-?\d+$/.test(value)) {
    return `${value}s`;
  }
  return value;
}

function readExpiresIn(env: NodeJS.ProcessEnv, name: string): string {
  const value = readRequiredEnv(env, name);
  if (!isValidExpiresIn(value)) {
    throw new Error(`Invalid value for ${name}: ${value}`);
  }
  return normalizeExpiresIn(value);
}

export function loadTokenConfig(env: NodeJS.ProcessEnv): TokenConfig {
  return {
    secret: validateSecretLength(readRequiredEnv(env, "JWT_SECRET")),
    accessExpiresIn: readExpiresIn(env, "JWT_ACCESS_EXPIRES_IN"),
    refreshExpiresIn: readExpiresIn(env, "JWT_REFRESH_EXPIRES_IN"),
  };
}

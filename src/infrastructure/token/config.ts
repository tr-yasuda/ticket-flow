import type { TokenConfig } from "../../domain/token";

const MIN_SECRET_BYTES = 32;

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

export function loadTokenConfig(env: NodeJS.ProcessEnv): TokenConfig {
  return {
    secret: validateSecretLength(readRequiredEnv(env, "JWT_SECRET")),
    accessExpiresIn: readRequiredEnv(env, "JWT_ACCESS_EXPIRES_IN"),
    refreshExpiresIn: readRequiredEnv(env, "JWT_REFRESH_EXPIRES_IN"),
  };
}

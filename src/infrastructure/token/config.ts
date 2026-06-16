import type { TokenConfig } from "../../domain/token";

function readRequiredEnv(env: NodeJS.ProcessEnv, name: string): string {
  const raw = env[name];
  if (raw === undefined || raw.trim() === "") {
    throw new Error(`${name} is required`);
  }
  return raw.trim();
}

export function loadTokenConfig(env: NodeJS.ProcessEnv): TokenConfig {
  return {
    secret: readRequiredEnv(env, "JWT_SECRET"),
    accessExpiresIn: readRequiredEnv(env, "JWT_ACCESS_EXPIRES_IN"),
    refreshExpiresIn: readRequiredEnv(env, "JWT_REFRESH_EXPIRES_IN"),
  };
}

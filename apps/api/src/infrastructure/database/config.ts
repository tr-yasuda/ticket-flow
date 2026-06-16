import type { ConnectionOptions } from "tls";

export type DatabaseConfig = Readonly<{
  connectionString: string;
  ssl?: boolean | ConnectionOptions;
}>;

function readConnectionString(env: NodeJS.ProcessEnv): string {
  return env.DATABASE_URL?.trim() ?? "";
}

function parseBooleanEnv(
  env: NodeJS.ProcessEnv,
  name: string,
): boolean | undefined {
  const raw = env[name];
  if (raw === undefined || raw.trim() === "") {
    return undefined;
  }
  const value = raw.trim().toLowerCase();
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new Error(`Invalid value for ${name}: ${raw}`);
}

function buildSslConfig(
  isSslEnabled: boolean | undefined,
  shouldRejectUnauthorized: boolean | undefined,
): boolean | ConnectionOptions | undefined {
  if (isSslEnabled === undefined) {
    return undefined;
  }
  if (isSslEnabled === false) {
    return false;
  }
  return { rejectUnauthorized: shouldRejectUnauthorized ?? true };
}

export function isDatabaseConfigured(env: NodeJS.ProcessEnv): boolean {
  return readConnectionString(env) !== "";
}

export function loadDatabaseConfig(env: NodeJS.ProcessEnv): DatabaseConfig {
  const connectionString = readConnectionString(env);
  if (connectionString === "") {
    throw new Error("DATABASE_URL is required");
  }
  return {
    connectionString,
    ssl: buildSslConfig(
      parseBooleanEnv(env, "DATABASE_SSL"),
      parseBooleanEnv(env, "DATABASE_SSL_REJECT_UNAUTHORIZED"),
    ),
  };
}

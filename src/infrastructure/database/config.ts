import type { ConnectionOptions } from "tls";

export type DatabaseConfig = Readonly<{
  connectionString: string;
  ssl?: boolean | ConnectionOptions;
}>;

function readConnectionString(env: NodeJS.ProcessEnv): string {
  return env.DATABASE_URL?.trim() ?? "";
}

function readSslEnabled(env: NodeJS.ProcessEnv): boolean | undefined {
  const value = env.DATABASE_SSL?.trim().toLowerCase();
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return undefined;
}

function readSslRejectUnauthorized(
  env: NodeJS.ProcessEnv,
): boolean | undefined {
  const value = env.DATABASE_SSL_REJECT_UNAUTHORIZED?.trim().toLowerCase();
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return undefined;
}

function buildSslConfig(
  sslEnabled: boolean | undefined,
  rejectUnauthorized: boolean | undefined,
): boolean | ConnectionOptions | undefined {
  if (sslEnabled === undefined) {
    return undefined;
  }
  if (sslEnabled === false) {
    return false;
  }
  if (rejectUnauthorized === undefined) {
    return true;
  }
  return { rejectUnauthorized };
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
    ssl: buildSslConfig(readSslEnabled(env), readSslRejectUnauthorized(env)),
  };
}

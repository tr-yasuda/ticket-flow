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

const allowedProtocols = ["postgres:", "postgresql:", "file:"] as const;

type AllowedProtocol = (typeof allowedProtocols)[number];

function validateConnectionString(connectionString: string): AllowedProtocol {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL");
  }
  const protocol = parsedUrl.protocol as AllowedProtocol;
  if (!allowedProtocols.includes(protocol)) {
    throw new Error(
      `DATABASE_URL must use postgres://, postgresql://, or file:// protocol, got: ${parsedUrl.protocol}`,
    );
  }
  if (
    (protocol === "postgres:" || protocol === "postgresql:") &&
    parsedUrl.hostname === ""
  ) {
    throw new Error(
      "DATABASE_URL must include a host for PostgreSQL connections",
    );
  }
  return protocol;
}

export function isDatabaseConfigured(env: NodeJS.ProcessEnv): boolean {
  const connectionString = readConnectionString(env);
  if (connectionString === "") {
    return false;
  }
  try {
    validateConnectionString(connectionString);
    return true;
  } catch {
    return false;
  }
}

export function loadDatabaseConfig(env: NodeJS.ProcessEnv): DatabaseConfig {
  const connectionString = readConnectionString(env);
  if (connectionString === "") {
    throw new Error("DATABASE_URL is required");
  }
  const protocol = validateConnectionString(connectionString);
  const isSqlite = protocol === "file:";
  return {
    connectionString,
    ssl: isSqlite
      ? undefined
      : buildSslConfig(
          parseBooleanEnv(env, "DATABASE_SSL"),
          parseBooleanEnv(env, "DATABASE_SSL_REJECT_UNAUTHORIZED"),
        ),
  };
}

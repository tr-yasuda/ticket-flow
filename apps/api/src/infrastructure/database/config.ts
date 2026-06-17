export type DatabaseConfig = Readonly<{
  connectionString: string;
}>;

function readConnectionString(env: NodeJS.ProcessEnv): string {
  return env.DATABASE_URL?.trim() ?? "";
}

function validateConnectionString(connectionString: string): void {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL");
  }
  if (parsedUrl.protocol !== "file:") {
    throw new Error(
      `DATABASE_URL must use file: protocol, got: ${parsedUrl.protocol}`,
    );
  }
  if (parsedUrl.pathname === "/" && parsedUrl.host === "") {
    throw new Error("DATABASE_URL must include a database file path");
  }
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
  validateConnectionString(connectionString);
  return { connectionString };
}

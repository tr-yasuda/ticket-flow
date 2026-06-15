export type DatabaseConfig = Readonly<{
  connectionString: string;
}>;

function readConnectionString(env: NodeJS.ProcessEnv): string {
  return env.DATABASE_URL?.trim() ?? "";
}

export function isDatabaseConfigured(env: NodeJS.ProcessEnv): boolean {
  return readConnectionString(env) !== "";
}

export function loadDatabaseConfig(env: NodeJS.ProcessEnv): DatabaseConfig {
  const connectionString = readConnectionString(env);
  if (connectionString === "") {
    throw new Error("DATABASE_URL is required");
  }
  return { connectionString };
}

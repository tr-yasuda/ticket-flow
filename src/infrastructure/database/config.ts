export type DatabaseConfig = Readonly<{
  connectionString: string;
}>;

export function loadDatabaseConfig(env: NodeJS.ProcessEnv): DatabaseConfig {
  const connectionString = env.DATABASE_URL ?? "";
  if (connectionString === "") {
    throw new Error("DATABASE_URL is required");
  }
  return { connectionString };
}

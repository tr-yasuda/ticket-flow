export type DatabaseHealth = Readonly<{
  status: "healthy" | "unhealthy";
  error?: Error;
}>;

export type Queryable = Readonly<{
  query(text: string): Promise<unknown>;
}>;

export async function checkDatabaseHealth(pool: Queryable): Promise<DatabaseHealth> {
  try {
    await pool.query("SELECT 1");
    return { status: "healthy" };
  } catch (error) {
    return {
      status: "unhealthy",
      error: error instanceof Error ? error : new Error("Unknown error"),
    };
  }
}

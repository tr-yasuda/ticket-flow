export type DatabaseHealth = Readonly<{
  status: "healthy" | "unhealthy";
  error?: Error;
}>;

export type DatabaseQueryable = Readonly<{
  $queryRaw(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<unknown>;
}>;

export async function checkDatabaseHealth(
  client: DatabaseQueryable,
): Promise<DatabaseHealth> {
  try {
    await client.$queryRaw`SELECT 1`;
    return { status: "healthy" };
  } catch (error) {
    return {
      status: "unhealthy",
      error: error instanceof Error ? error : new Error("Unknown error"),
    };
  }
}

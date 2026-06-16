const defaultTestDatabaseUrl = "file:./prisma/test.db";

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === "") {
  process.env.DATABASE_URL = defaultTestDatabaseUrl;
}

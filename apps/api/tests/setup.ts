import { resolve } from "node:path";

const defaultTestDatabaseUrl = `file:${resolve(process.cwd(), "prisma/test.db")}`;

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === "") {
  process.env.DATABASE_URL = defaultTestDatabaseUrl;
}

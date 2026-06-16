import { resolve } from "node:path";

const defaultTestDatabaseUrl = `file:${resolve(import.meta.dirname, "../prisma/test.db")}`;

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === "") {
  process.env.DATABASE_URL = defaultTestDatabaseUrl;
}

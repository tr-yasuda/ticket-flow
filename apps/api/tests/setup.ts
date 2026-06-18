import { createTestDatabaseUrl } from "./test-database-url.js";

const defaultTestDatabaseUrl = createTestDatabaseUrl("prisma/test.db");

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === "") {
  process.env.DATABASE_URL = defaultTestDatabaseUrl;
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === "") {
  process.env.JWT_SECRET = "test-secret-that-is-at-least-32-bytes-long";
}

if (
  !process.env.JWT_ACCESS_EXPIRES_IN ||
  process.env.JWT_ACCESS_EXPIRES_IN.trim() === ""
) {
  process.env.JWT_ACCESS_EXPIRES_IN = "15m";
}

if (
  !process.env.JWT_REFRESH_EXPIRES_IN ||
  process.env.JWT_REFRESH_EXPIRES_IN.trim() === ""
) {
  process.env.JWT_REFRESH_EXPIRES_IN = "7d";
}

import { serve } from "@hono/node-server";

import { hashPassword } from "./domain/password.js";
import { generateAccessToken, generateRefreshToken } from "./domain/token.js";
import { loadDatabaseConfig } from "./infrastructure/database/config.js";
import { createPrismaClient } from "./infrastructure/database/prisma-client.js";
import { PrismaUserRepository } from "./infrastructure/database/prisma-user-repository.js";
import { loadTokenConfig } from "./infrastructure/token/config.js";
import { createApp } from "./presentation/app.js";

function parsePort(raw: string | undefined): number {
  const value = raw ?? "3000";
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${value}`);
  }
  return port;
}

const port = parsePort(process.env.PORT);

const databaseConfig = loadDatabaseConfig(process.env);
const prisma = createPrismaClient(databaseConfig);
const userRepository = new PrismaUserRepository(prisma);
const tokenConfig = loadTokenConfig(process.env);

const app = createApp({
  userRepository,
  hashPassword,
  generateAccessToken: async (userId) =>
    generateAccessToken({ userId }, tokenConfig),
  generateRefreshToken: async (userId) =>
    generateRefreshToken({ userId }, tokenConfig),
});

const server = serve({
  fetch: app.fetch,
  port,
});

function shutdown(signal: string): void {
  console.log(`Received ${signal}, shutting down...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

console.log(`Server is running on http://localhost:${port}`);

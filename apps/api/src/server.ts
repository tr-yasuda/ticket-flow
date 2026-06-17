import { serve } from "@hono/node-server";

import { hashPassword, verifyPassword } from "./domain/password.js";
import { generateAccessToken, generateRefreshToken } from "./domain/token.js";
import { loadDatabaseConfig } from "./infrastructure/database/config.js";
import { createPrismaClient } from "./infrastructure/database/prisma-client.js";
import { PrismaUserRepository } from "./infrastructure/database/prisma-user-repository.js";
import { parsePort } from "./infrastructure/server/port.js";
import { loadTokenConfig } from "./infrastructure/token/config.js";
import { createApp } from "./presentation/app.js";

const port = parsePort(process.env.PORT);

const databaseConfig = loadDatabaseConfig(process.env);
const prisma = createPrismaClient(databaseConfig);
const userRepository = new PrismaUserRepository(prisma);
const tokenConfig = loadTokenConfig(process.env);

const app = createApp({
  userRepository,
  hashPassword,
  verifyPassword,
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
  server.close(() => {
    prisma
      .$disconnect()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error("Failed to disconnect Prisma:", error);
        process.exit(1);
      });
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

console.log(`Server is running on http://localhost:${port}`);

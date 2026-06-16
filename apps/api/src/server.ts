import { serve } from "@hono/node-server";

import { hashPassword } from "./domain/password.js";
import { generateAccessToken, generateRefreshToken } from "./domain/token.js";
import { loadDatabaseConfig } from "./infrastructure/database/config.js";
import { createPrismaClient } from "./infrastructure/database/prisma-client.js";
import { PrismaUserRepository } from "./infrastructure/database/prisma-user-repository.js";
import { loadTokenConfig } from "./infrastructure/token/config.js";
import { createApp } from "./presentation/app.js";

const port = Number(process.env.PORT ?? "3000");

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

serve({
  fetch: app.fetch,
  port,
});

console.log(`Server is running on http://localhost:${port}`);

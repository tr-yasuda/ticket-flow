import { createPrismaClient } from "../infrastructure/database/prisma-client.js";
import { env } from "./env.js";

export const prisma = createPrismaClient({
  connectionString: env.DATABASE_URL,
});

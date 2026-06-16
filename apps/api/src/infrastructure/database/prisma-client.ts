import { PrismaClient } from "@prisma/client";

import type { DatabaseConfig } from "./config.js";

export function createPrismaClient(config: DatabaseConfig): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: {
        url: config.connectionString,
      },
    },
  });
}

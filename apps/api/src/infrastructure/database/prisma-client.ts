import { PrismaClient } from "@prisma/client";

export type DatabaseConfig = Readonly<{
  connectionString: string;
}>;

export function createPrismaClient(config: DatabaseConfig): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: {
        url: config.connectionString,
      },
    },
  });
}

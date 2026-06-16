import { Pool } from "pg";

import type { DatabaseConfig } from "./config";

export function createDatabasePool(config: DatabaseConfig): Pool {
  return new Pool({
    connectionString: config.connectionString,
  });
}

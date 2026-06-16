import { Pool } from "pg";

import type { DatabaseConfig } from "./config.js";

export function createDatabasePool(config: DatabaseConfig): Pool {
  return new Pool({
    connectionString: config.connectionString,
    ssl: config.ssl,
  });
}

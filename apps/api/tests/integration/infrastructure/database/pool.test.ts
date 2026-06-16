import { Pool } from "pg";
import { describe, expect, it } from "vitest";

import { createDatabasePool } from "../../../../src/infrastructure/database/pool";

describe("データベース接続プール", () => {
  it("接続文字列を使って Pool を作成する", async () => {
    const pool = createDatabasePool({
      connectionString: "postgres://user:pass@localhost:5432/db",
    });

    try {
      expect(pool).toBeInstanceOf(Pool);
      expect(pool.options.ssl).toBeUndefined();
    } finally {
      await pool.end();
    }
  });

  it("SSL 設定を Pool に渡す", async () => {
    const pool = createDatabasePool({
      connectionString: "postgres://user:pass@localhost:5432/db",
      ssl: { rejectUnauthorized: false },
    });

    try {
      expect(pool.options.ssl).toEqual({ rejectUnauthorized: false });
    } finally {
      await pool.end();
    }
  });
});

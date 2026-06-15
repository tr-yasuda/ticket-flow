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
    } finally {
      await pool.end();
    }
  });
});

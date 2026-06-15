import { describe, expect, it } from "vitest";
import { loadDatabaseConfig } from "../../../../src/infrastructure/database/config";

describe("データベース設定", () => {
  it("DATABASE_URL が設定されている場合は設定を返す", () => {
    const config = loadDatabaseConfig({
      DATABASE_URL: "postgres://user:pass@localhost:5432/db",
    });

    expect(config.connectionString).toBe("postgres://user:pass@localhost:5432/db");
  });

  it("DATABASE_URL がない場合はエラーになる", () => {
    expect(() => loadDatabaseConfig({})).toThrow("DATABASE_URL");
  });

  it("DATABASE_URL が空文字の場合はエラーになる", () => {
    expect(() => loadDatabaseConfig({ DATABASE_URL: "" })).toThrow("DATABASE_URL");
  });
});

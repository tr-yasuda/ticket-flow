import { describe, expect, it } from "vitest";

import {
  isDatabaseConfigured,
  loadDatabaseConfig,
} from "../../../../src/infrastructure/database/config";

describe("データベース設定", () => {
  describe("isDatabaseConfigured", () => {
    it("有効な SQLite file URL が設定されている場合は true を返す", () => {
      expect(isDatabaseConfigured({ DATABASE_URL: "file:./dev.db" })).toBe(
        true,
      );
    });

    it("DATABASE_URL が未設定の場合は false を返す", () => {
      expect(isDatabaseConfigured({})).toBe(false);
    });

    it("DATABASE_URL が空文字の場合は false を返す", () => {
      expect(isDatabaseConfigured({ DATABASE_URL: "" })).toBe(false);
    });

    it("DATABASE_URL が無効な URL の場合は false を返す", () => {
      expect(isDatabaseConfigured({ DATABASE_URL: "not-a-url" })).toBe(false);
    });

    it("DATABASE_URL が file 以外のプロトコルの場合は false を返す", () => {
      expect(
        isDatabaseConfigured({ DATABASE_URL: "http://localhost:5432/db" }),
      ).toBe(false);
    });

    it("DATABASE_URL にファイルパスがない場合は false を返す", () => {
      expect(isDatabaseConfigured({ DATABASE_URL: "file:" })).toBe(false);
    });
  });

  it("DATABASE_URL が設定されている場合は設定を返す", () => {
    const config = loadDatabaseConfig({ DATABASE_URL: "file:./dev.db" });

    expect(config.connectionString).toBe("file:./dev.db");
  });

  it("DATABASE_URL がない場合はエラーになる", () => {
    expect(() => loadDatabaseConfig({})).toThrow("DATABASE_URL");
  });

  it("DATABASE_URL が空文字の場合はエラーになる", () => {
    expect(() => loadDatabaseConfig({ DATABASE_URL: "" })).toThrow(
      "DATABASE_URL",
    );
  });

  it("DATABASE_URL が空白のみの場合はエラーになる", () => {
    expect(() => loadDatabaseConfig({ DATABASE_URL: "   " })).toThrow(
      "DATABASE_URL",
    );
  });

  it("DATABASE_URL が無効な URL の場合はエラーになる", () => {
    expect(() => loadDatabaseConfig({ DATABASE_URL: "not-a-url" })).toThrow(
      "DATABASE_URL is not a valid URL",
    );
  });

  it("DATABASE_URL のプロトコルが file 以外の場合はエラーになる", () => {
    expect(() =>
      loadDatabaseConfig({ DATABASE_URL: "http://localhost:5432/db" }),
    ).toThrow("got: http:");
  });

  it("DATABASE_URL にファイルパスがない場合はエラーになる", () => {
    expect(() => loadDatabaseConfig({ DATABASE_URL: "file:" })).toThrow(
      "DATABASE_URL must include a database file path",
    );
  });
});

import { describe, expect, it } from "vitest";

import { loadDatabaseConfig } from "../../../../src/infrastructure/database/config";

describe("データベース設定", () => {
  it("DATABASE_URL が設定されている場合は設定を返す", () => {
    const config = loadDatabaseConfig({
      DATABASE_URL: "postgres://user:pass@localhost:5432/db",
    });

    expect(config.connectionString).toBe(
      "postgres://user:pass@localhost:5432/db",
    );
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

  it("DATABASE_URL のプロトコルが postgres / postgresql 以外の場合はエラーになる", () => {
    expect(() =>
      loadDatabaseConfig({ DATABASE_URL: "localhost:5432/db" }),
    ).toThrow("got: localhost:");
  });

  it("DATABASE_URL のプロトコルが http の場合はエラーになる", () => {
    expect(() =>
      loadDatabaseConfig({ DATABASE_URL: "http://localhost:5432/db" }),
    ).toThrow("got: http:");
  });

  it("DATABASE_URL が postgres:// 形式でない opaque URL の場合はエラーになる", () => {
    expect(() => loadDatabaseConfig({ DATABASE_URL: "postgres:foo" })).toThrow(
      "got: postgres:",
    );
  });

  it("postgresql:// プロトコルの DATABASE_URL は有効である", () => {
    const config = loadDatabaseConfig({
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    });

    expect(config.connectionString).toBe(
      "postgresql://user:pass@localhost:5432/db",
    );
  });

  it("DATABASE_SSL=true の場合は SSL を有効にする", () => {
    const config = loadDatabaseConfig({
      DATABASE_URL: "postgres://user:pass@localhost:5432/db",
      DATABASE_SSL: "true",
    });

    expect(config.ssl).toEqual({ rejectUnauthorized: true });
  });

  it("DATABASE_SSL=false の場合は SSL を無効にする", () => {
    const config = loadDatabaseConfig({
      DATABASE_URL: "postgres://user:pass@localhost:5432/db",
      DATABASE_SSL: "false",
    });

    expect(config.ssl).toBe(false);
  });

  it("DATABASE_SSL_REJECT_UNAUTHORIZED=false の場合は自己署名証明書を許可する", () => {
    const config = loadDatabaseConfig({
      DATABASE_URL: "postgres://user:pass@localhost:5432/db",
      DATABASE_SSL: "true",
      DATABASE_SSL_REJECT_UNAUTHORIZED: "false",
    });

    expect(config.ssl).toEqual({ rejectUnauthorized: false });
  });

  it("DATABASE_SSL が未設定の場合は ssl を指定しない", () => {
    const config = loadDatabaseConfig({
      DATABASE_URL: "postgres://user:pass@localhost:5432/db",
    });

    expect(config.ssl).toBeUndefined();
  });

  it("DATABASE_SSL=false の場合は DATABASE_SSL_REJECT_UNAUTHORIZED を無視する", () => {
    const config = loadDatabaseConfig({
      DATABASE_URL: "postgres://user:pass@localhost:5432/db",
      DATABASE_SSL: "false",
      DATABASE_SSL_REJECT_UNAUTHORIZED: "false",
    });

    expect(config.ssl).toBe(false);
  });

  it("DATABASE_SSL に無効な値が設定されている場合はエラーになる", () => {
    expect(() =>
      loadDatabaseConfig({
        DATABASE_URL: "postgres://user:pass@localhost:5432/db",
        DATABASE_SSL: "ture",
      }),
    ).toThrow("Invalid value for DATABASE_SSL");
  });

  it("DATABASE_SSL_REJECT_UNAUTHORIZED に無効な値が設定されている場合はエラーになる", () => {
    expect(() =>
      loadDatabaseConfig({
        DATABASE_URL: "postgres://user:pass@localhost:5432/db",
        DATABASE_SSL: "true",
        DATABASE_SSL_REJECT_UNAUTHORIZED: "maybe",
      }),
    ).toThrow("Invalid value for DATABASE_SSL_REJECT_UNAUTHORIZED");
  });
});

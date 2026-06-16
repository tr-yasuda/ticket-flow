import { describe, expect, it } from "vitest";

import { loadTokenConfig } from "../../../../src/infrastructure/token/config.js";

describe("JWT 設定", () => {
  it("必要な環境変数が設定されている場合は設定を返す", () => {
    const config = loadTokenConfig({
      JWT_SECRET: "test-secret-at-least-32-bytes-long!",
      JWT_ACCESS_EXPIRES_IN: "15m",
      JWT_REFRESH_EXPIRES_IN: "7d",
    });

    expect(config.secret).toBe("test-secret-at-least-32-bytes-long!");
    expect(config.accessExpiresIn).toBe("15m");
    expect(config.refreshExpiresIn).toBe("7d");
  });

  it("有効期限が数値のみの場合は秒単位に正規化される", () => {
    const config = loadTokenConfig({
      JWT_SECRET: "test-secret-at-least-32-bytes-long!",
      JWT_ACCESS_EXPIRES_IN: "3600",
      JWT_REFRESH_EXPIRES_IN: "604800",
    });

    expect(config.accessExpiresIn).toBe("3600s");
    expect(config.refreshExpiresIn).toBe("604800s");
  });

  it("JWT_SECRET がない場合はエラーになる", () => {
    expect(() =>
      loadTokenConfig({
        JWT_ACCESS_EXPIRES_IN: "15m",
        JWT_REFRESH_EXPIRES_IN: "7d",
      }),
    ).toThrow("JWT_SECRET");
  });

  it("JWT_SECRET が空文字の場合はエラーになる", () => {
    expect(() =>
      loadTokenConfig({
        JWT_SECRET: "",
        JWT_ACCESS_EXPIRES_IN: "15m",
        JWT_REFRESH_EXPIRES_IN: "7d",
      }),
    ).toThrow("JWT_SECRET");
  });

  it("JWT_SECRET が空白のみの場合はエラーになる", () => {
    expect(() =>
      loadTokenConfig({
        JWT_SECRET: "   ",
        JWT_ACCESS_EXPIRES_IN: "15m",
        JWT_REFRESH_EXPIRES_IN: "7d",
      }),
    ).toThrow("JWT_SECRET");
  });

  it("JWT_SECRET が32バイト未満の場合はエラーになる", () => {
    expect(() =>
      loadTokenConfig({
        JWT_SECRET: "short-secret",
        JWT_ACCESS_EXPIRES_IN: "15m",
        JWT_REFRESH_EXPIRES_IN: "7d",
      }),
    ).toThrow("JWT_SECRET must be at least 32 bytes");
  });

  it("JWT_ACCESS_EXPIRES_IN がない場合はエラーになる", () => {
    expect(() =>
      loadTokenConfig({
        JWT_SECRET: "test-secret-at-least-32-bytes-long!",
        JWT_REFRESH_EXPIRES_IN: "7d",
      }),
    ).toThrow("JWT_ACCESS_EXPIRES_IN");
  });

  it("JWT_ACCESS_EXPIRES_IN が空文字の場合はエラーになる", () => {
    expect(() =>
      loadTokenConfig({
        JWT_SECRET: "test-secret-at-least-32-bytes-long!",
        JWT_ACCESS_EXPIRES_IN: "",
        JWT_REFRESH_EXPIRES_IN: "7d",
      }),
    ).toThrow("JWT_ACCESS_EXPIRES_IN");
  });

  it("JWT_REFRESH_EXPIRES_IN がない場合はエラーになる", () => {
    expect(() =>
      loadTokenConfig({
        JWT_SECRET: "test-secret-at-least-32-bytes-long!",
        JWT_ACCESS_EXPIRES_IN: "15m",
      }),
    ).toThrow("JWT_REFRESH_EXPIRES_IN");
  });

  it("JWT_ACCESS_EXPIRES_IN の形式が不正な場合はエラーになる", () => {
    expect(() =>
      loadTokenConfig({
        JWT_SECRET: "test-secret-at-least-32-bytes-long!",
        JWT_ACCESS_EXPIRES_IN: "1x",
        JWT_REFRESH_EXPIRES_IN: "7d",
      }),
    ).toThrow("Invalid value for JWT_ACCESS_EXPIRES_IN");
  });

  it("JWT_REFRESH_EXPIRES_IN の形式が不正な場合はエラーになる", () => {
    expect(() =>
      loadTokenConfig({
        JWT_SECRET: "test-secret-at-least-32-bytes-long!",
        JWT_ACCESS_EXPIRES_IN: "15m",
        JWT_REFRESH_EXPIRES_IN: "invalid",
      }),
    ).toThrow("Invalid value for JWT_REFRESH_EXPIRES_IN");
  });
});

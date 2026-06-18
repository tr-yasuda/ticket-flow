import { describe, expect, it } from "vitest";

import { env } from "../../../src/lib/env.js";

describe("env", () => {
  it("DATABASE_URL が file: プロトコルで設定されている", () => {
    expect(env.DATABASE_URL).toMatch(/^file:/);
  });

  it("JWT_SECRET が 32 バイト以上である", () => {
    expect(env.JWT_SECRET.length).toBeGreaterThanOrEqual(32);
  });

  it("JWT 有効期限が設定されている", () => {
    expect(env.JWT_ACCESS_EXPIRES_IN).toBeTruthy();
    expect(env.JWT_REFRESH_EXPIRES_IN).toBeTruthy();
  });
});

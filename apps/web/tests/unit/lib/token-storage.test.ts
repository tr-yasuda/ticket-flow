import { describe, expect, it } from "vitest";

import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "@/lib/token-storage";

describe("token-storage", () => {
  it("トークンを設定・取得できる", () => {
    setTokens("access-token", "refresh-token");

    expect(getAccessToken()).toBe("access-token");
    expect(getRefreshToken()).toBe("refresh-token");
  });

  it("clearTokens でトークンが削除される", () => {
    setTokens("access-token", "refresh-token");
    clearTokens();

    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });
});

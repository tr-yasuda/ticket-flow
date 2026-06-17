import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
  subscribeAccessToken,
} from "@/lib/token-storage";

describe("token-storage", () => {
  beforeEach(() => {
    clearTokens();
  });

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

  it("setTokens / clearTokens で購読者に通知される", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAccessToken(listener);

    setTokens("access-token", "refresh-token");
    expect(listener).toHaveBeenCalledTimes(1);

    clearTokens();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it("unsubscribe 後は通知されない", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAccessToken(listener);

    unsubscribe();
    setTokens("access-token", "refresh-token");
    expect(listener).not.toHaveBeenCalled();
  });
});

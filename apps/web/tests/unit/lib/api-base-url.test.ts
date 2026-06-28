import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildApiUrl, getApiBaseUrl } from "@/lib/api-base-url";

describe("getApiBaseUrl", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("未設定時は /api にフォールバックする", () => {
    expect(getApiBaseUrl()).toBe("/api");
  });

  it("空文字列時も /api にフォールバックする", () => {
    vi.stubEnv("VITE_API_BASE_URL", "  ");
    expect(getApiBaseUrl()).toBe("/api");
  });

  it("設定値をトリムして返す", () => {
    vi.stubEnv("VITE_API_BASE_URL", " /api/v1 ");
    expect(getApiBaseUrl()).toBe("/api/v1");
  });
});

describe("buildApiUrl", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("デフォルト設定で /api/<path> を構築する", () => {
    expect(buildApiUrl("protected")).toBe("/api/protected");
    expect(buildApiUrl("/protected")).toBe("/api/protected");
  });

  it("末尾スラッシュのある base URL を正規化する", () => {
    vi.stubEnv("VITE_API_BASE_URL", "/api/");
    expect(buildApiUrl("protected")).toBe("/api/protected");
  });

  it("絶対 URL の base に path を追加する", () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com/api");
    expect(buildApiUrl("protected")).toBe(
      "https://api.example.com/api/protected",
    );
  });

  it("絶対 URL の末尾スラッシュを正規化する", () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com/api/");
    expect(buildApiUrl("protected")).toBe(
      "https://api.example.com/api/protected",
    );
  });

  it("絶対 URL のクエリ文字列を保持する", () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com/api?key=1");
    expect(buildApiUrl("protected")).toBe(
      "https://api.example.com/api/protected?key=1",
    );
  });
});

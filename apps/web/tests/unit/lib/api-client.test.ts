import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient, ApiError } from "@/lib/api-client";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "@/lib/token-storage";

function getFirstRequest(fetchMock: ReturnType<typeof vi.fn>): Request {
  const [request] = fetchMock.mock.calls[0] as [Request];
  return request;
}

describe("apiClient", () => {
  beforeEach(() => {
    clearTokens();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("アクセストークンがある場合は Authorization ヘッダーを付与する", async () => {
    setTokens("access-token", "refresh-token");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    globalThis.fetch = fetchMock;

    await apiClient.get("protected");

    const request = getFirstRequest(fetchMock);
    expect(request.headers.get("Authorization")).toBe("Bearer access-token");
  });

  it("401 応答時にリフレッシュして元リクエストをリトライする", async () => {
    setTokens("expired-access", "refresh-token");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: "new-access" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    globalThis.fetch = fetchMock;

    const result = await apiClient.get("protected").json<{ ok: boolean }>();

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(getAccessToken()).toBe("new-access");
    const [retryRequest] = fetchMock.mock.calls[2] as [Request];
    expect(retryRequest).toBeInstanceOf(Request);
    expect(retryRequest.headers.get("Authorization")).toBe("Bearer new-access");
  });

  it("リフレッシュに失敗した場合はトークンをクリアしてエラーを投げる", async () => {
    setTokens("expired-access", "refresh-token");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
        }),
      );
    globalThis.fetch = fetchMock;

    await expect(apiClient.get("protected")).rejects.toThrow(ApiError);
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("API エラーレスポンスを ApiError に変換する", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: "bad request" }), { status: 400 }),
      );
    globalThis.fetch = fetchMock;

    await expect(apiClient.get("protected")).rejects.toThrow(ApiError);
    try {
      await apiClient.get("protected");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(400);
      expect((error as ApiError).message).toBe("bad request");
    }
  });
});

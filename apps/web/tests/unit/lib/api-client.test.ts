import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient, ApiError } from "@/lib/api-client";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "@/lib/token-storage";

function mockFetch(impl: ReturnType<typeof vi.fn>): ReturnType<typeof vi.fn> {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(impl as unknown as typeof fetch);
}

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
    mockFetch(fetchMock);

    await apiClient.get("protected");

    const request = getFirstRequest(fetchMock);
    expect(request.headers.get("Authorization")).toBe("Bearer access-token");
  });

  it("デフォルト設定で /api/<path> にリクエストする", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    mockFetch(fetchMock);

    await apiClient.get("protected");

    const request = getFirstRequest(fetchMock);
    expect(new URL(request.url).pathname).toBe("/api/protected");
  });

  it("401 応答時にリフレッシュして元リクエストをリトライする", async () => {
    setTokens("expired-access", "refresh-token");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "AUTH_UNAUTHORIZED",
              message: "認証が必要です",
            },
          }),
          { status: 401 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: "new-access" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    mockFetch(fetchMock);

    const result = await apiClient.get("protected").json<{ ok: boolean }>();

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(getAccessToken()).toBe("new-access");
    const [retryRequest] = fetchMock.mock.calls[2] as [Request];
    expect(retryRequest).toBeInstanceOf(Request);
    expect(retryRequest.headers.get("Authorization")).toBe("Bearer new-access");
  });

  it("POST 401 応答時にリフレッシュして元リクエストをリトライする", async () => {
    setTokens("expired-access", "refresh-token");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "AUTH_UNAUTHORIZED",
              message: "認証が必要です",
            },
          }),
          { status: 401 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: "new-access" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    mockFetch(fetchMock);

    const result = await apiClient
      .post("protected", { json: { name: "test" } })
      .json<{ ok: boolean }>();

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(getAccessToken()).toBe("new-access");
    const [retryRequest] = fetchMock.mock.calls[2] as [Request];
    expect(retryRequest).toBeInstanceOf(Request);
    expect(retryRequest.headers.get("Authorization")).toBe("Bearer new-access");
    expect(retryRequest.method).toBe("POST");
    expect(await retryRequest.clone().json()).toEqual({ name: "test" });
  });

  it("リフレッシュに失敗した場合はトークンをクリアしてエラーを投げる", async () => {
    setTokens("expired-access", "refresh-token");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "AUTH_UNAUTHORIZED",
              message: "認証が必要です",
            },
          }),
          { status: 401 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
        }),
      );
    mockFetch(fetchMock);

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
    mockFetch(fetchMock);

    await expect(apiClient.get("protected")).rejects.toThrow(ApiError);
    try {
      await apiClient.get("protected");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(400);
      expect((error as ApiError).message).toBe("bad request");
    }
  });

  it("API エラーの details を ApiError に伝播する", async () => {
    const details = [{ field: "email", message: "メールアドレスが無効です" }];
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "入力内容を確認してください",
          details,
        }),
        { status: 400 },
      ),
    );
    mockFetch(fetchMock);

    try {
      await apiClient.get("protected");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.status).toBe(400);
      expect(apiError.details).toEqual(details);
    }
  });

  it("共通エラー形式のレスポンスを ApiError に変換する", async () => {
    const details = [{ field: "email", message: "メールアドレスが無効です" }];
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "入力内容を確認してください",
            details,
          },
        }),
        { status: 400 },
      ),
    );
    mockFetch(fetchMock);

    const request = apiClient.get("protected");
    await expect(request).rejects.toThrow(ApiError);
    const error = await request.catch((reason) => reason);
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(400);
    expect(apiError.message).toBe("入力内容を確認してください");
    expect(apiError.details).toEqual(details);
  });

  it("不正な details は無視して ApiError を生成する", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "入力内容を確認してください",
          details: [
            { field: "email", message: "有効な詳細" },
            { field: 123, message: "無効な詳細" },
            "不正な要素",
          ],
        }),
        { status: 400 },
      ),
    );
    mockFetch(fetchMock);

    try {
      await apiClient.get("protected");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.status).toBe(400);
      expect(apiError.details).toEqual([
        { field: "email", message: "有効な詳細" },
      ]);
    }
  });

  it("POST で一時的なネットワークエラー時に retry しない", async () => {
    setTokens("access-token", "refresh-token");
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Network error"));
    mockFetch(fetchMock);

    await expect(
      apiClient.post("protected", { json: { name: "test" } }),
    ).rejects.toThrow(TypeError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["put", "patch", "delete"] as const)(
    "%s で一時的なネットワークエラー時に retry しない",
    async (method) => {
      setTokens("access-token", "refresh-token");
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new TypeError("Network error"));
      mockFetch(fetchMock);

      await expect(apiClient[method]("protected")).rejects.toThrow(TypeError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("refresh 後の再送が 401 になっても無限ループしない", async () => {
    setTokens("expired-access", "refresh-token");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "AUTH_UNAUTHORIZED",
              message: "認証が必要です",
            },
          }),
          { status: 401 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: "new-access" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "AUTH_UNAUTHORIZED",
              message: "認証が必要です",
            },
          }),
          { status: 401 },
        ),
      );
    mockFetch(fetchMock);

    await expect(apiClient.get("protected")).rejects.toThrow(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(getAccessToken()).toBe("new-access");
  });

  it("refresh endpoint 自体の 401 では無限ループしない", async () => {
    setTokens("expired-access", "refresh-token");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "AUTH_UNAUTHORIZED",
            message: "認証が必要です",
          },
        }),
        { status: 401 },
      ),
    );
    mockFetch(fetchMock);

    await expect(apiClient.get("protected")).rejects.toThrow(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

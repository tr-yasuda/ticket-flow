import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { addAuthHeader, refreshAccessToken } from "@/lib/api-auth-hooks";
import { ApiError } from "@/lib/api-error";
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

function invokeAddAuthHeader(request: Request) {
  return addAuthHeader(request, {} as never, { retryCount: 0 });
}

describe("addAuthHeader", () => {
  beforeEach(() => {
    clearTokens();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("アクセストークンがある場合は Authorization ヘッダーを付与する", () => {
    setTokens("access-token", "refresh-token");
    const request = new Request("https://example.com/protected");

    const result = invokeAddAuthHeader(request);

    expect(result).toBeInstanceOf(Request);
    expect((result as Request).headers.get("Authorization")).toBe(
      "Bearer access-token",
    );
  });

  it("トークン未設定時はヘッダーを付与しない", () => {
    const request = new Request("https://example.com/protected");

    const result = invokeAddAuthHeader(request);

    expect(result).toBeUndefined();
    expect(request.headers.has("Authorization")).toBe(false);
  });

  it("空文字や空白のみのトークンではヘッダーを付与しない", () => {
    setTokens("   ", "refresh-token");
    const request = new Request("https://example.com/protected");

    const result = invokeAddAuthHeader(request);

    expect(result).toBeUndefined();
  });

  it("既存の Authorization ヘッダーは上書きしない", () => {
    setTokens("access-token", "refresh-token");
    const request = new Request("https://example.com/protected", {
      headers: { Authorization: "Bearer existing" },
    });

    const result = invokeAddAuthHeader(request);

    expect(result).toBeUndefined();
    expect(request.headers.get("Authorization")).toBe("Bearer existing");
  });
});

describe("refreshAccessToken", () => {
  beforeEach(() => {
    clearTokens();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retryCount が 1 でない場合は何もしない", async () => {
    const request = new Request("https://example.com/protected");

    const result = await refreshAccessToken({
      request,
      retryCount: 0,
    } as unknown as Parameters<typeof refreshAccessToken>[0]);

    expect(result).toBeUndefined();
  });

  it("リフレッシュ成功時にトークンを更新してリクエストに新しいヘッダーを付与する", async () => {
    setTokens("expired-access", "refresh-token");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            accessToken: "new-access",
            refreshToken: "new-refresh",
          }),
          { status: 200 },
        ),
      );
    mockFetch(fetchMock);

    const request = new Request("https://example.com/protected");
    const result = await refreshAccessToken({
      request,
      retryCount: 1,
    } as unknown as Parameters<typeof refreshAccessToken>[0]);

    expect(result).toBeInstanceOf(Request);
    expect((result as Request).headers.get("Authorization")).toBe(
      "Bearer new-access",
    );
    expect(getAccessToken()).toBe("new-access");
    expect(getRefreshToken()).toBe("new-refresh");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, refreshOptions] = fetchMock.mock.calls[0] as [
      string,
      { headers: Record<string, string> },
    ];
    expect(refreshOptions.headers.Authorization).toBe("Bearer refresh-token");
  });

  it("リフレッシュ失敗時はトークンをクリアしてエラーを投げる", async () => {
    setTokens("expired-access", "refresh-token");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
        }),
      );
    mockFetch(fetchMock);

    const request = new Request("https://example.com/protected");
    await expect(
      refreshAccessToken({
        request,
        retryCount: 1,
      } as unknown as Parameters<typeof refreshAccessToken>[0]),
    ).rejects.toBeInstanceOf(ApiError);

    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("空文字のリフレッシュトークンではリフレッシュを試行しない", async () => {
    setTokens("expired-access", "   ");
    const fetchMock = vi.fn();
    mockFetch(fetchMock);

    const request = new Request("https://example.com/protected");
    await expect(
      refreshAccessToken({
        request,
        retryCount: 1,
      } as unknown as Parameters<typeof refreshAccessToken>[0]),
    ).rejects.toBeInstanceOf(ApiError);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("並列したリフレッシュは 1 回のみ実行する", async () => {
    setTokens("expired-access", "refresh-token");
    let resolveRefresh: (response: Response) => void = () => {};
    const refreshPromise = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    const fetchMock = vi.fn().mockImplementation(() => refreshPromise);
    mockFetch(fetchMock);

    const request = new Request("https://example.com/protected");
    const promise1 = refreshAccessToken({
      request,
      retryCount: 1,
    } as unknown as Parameters<typeof refreshAccessToken>[0]);
    const promise2 = refreshAccessToken({
      request,
      retryCount: 1,
    } as unknown as Parameters<typeof refreshAccessToken>[0]);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveRefresh(
      new Response(JSON.stringify({ accessToken: "new-access" }), {
        status: 200,
      }),
    );
    const [result1, result2] = await Promise.all([promise1, promise2]);

    expect(result1).toBeInstanceOf(Request);
    expect(result2).toBeInstanceOf(Request);
    expect(getAccessToken()).toBe("new-access");
  });
});

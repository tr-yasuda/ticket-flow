import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  addAuthHeader,
  handleUnauthorizedResponse,
} from "@/lib/api-auth-hooks";
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

function createOptions(context: Record<string, unknown> = {}) {
  return { context } as unknown as Parameters<
    typeof handleUnauthorizedResponse
  >[1];
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

describe("handleUnauthorizedResponse", () => {
  beforeEach(() => {
    clearTokens();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("401 応答で refresh 成功後に元リクエストを再送する", async () => {
    setTokens("expired-access", "refresh-token");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accessToken: "new-access",
            refreshToken: "new-refresh",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    mockFetch(fetchMock);

    const request = new Request("http://localhost/api/protected");
    const response = new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
    const result = (await handleUnauthorizedResponse(
      request,
      createOptions(),
      response,
      { retryCount: 0 },
    )) as Response;

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getAccessToken()).toBe("new-access");
    expect(getRefreshToken()).toBe("new-refresh");
  });

  it("refresh 失敗時はトークンをクリアしてエラーを投げる", async () => {
    setTokens("expired-access", "refresh-token");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
      }),
    );
    mockFetch(fetchMock);

    const request = new Request("http://localhost/api/protected");
    const response = new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
    await expect(
      handleUnauthorizedResponse(request, createOptions(), response, {
        retryCount: 0,
      }),
    ).rejects.toBeInstanceOf(ApiError);

    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("空文字のリフレッシュトークンではリフレッシュを試行しない", async () => {
    setTokens("expired-access", "   ");
    const fetchMock = vi.fn();
    mockFetch(fetchMock);

    const request = new Request("http://localhost/api/protected");
    const response = new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
    const result = (await handleUnauthorizedResponse(
      request,
      createOptions(),
      response,
      { retryCount: 0 },
    )) as Response;

    expect(result.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("refresh endpoint 自体の 401 では無限ループしない", async () => {
    setTokens("expired-access", "refresh-token");
    const fetchMock = vi.fn();
    mockFetch(fetchMock);

    const request = new Request("http://localhost/api/auth/refresh");
    const response = new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
    const result = (await handleUnauthorizedResponse(
      request,
      createOptions(),
      response,
      { retryCount: 0 },
    )) as Response;

    expect(result.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("2 度目の 401 ではリフレッシュを試行しない", async () => {
    setTokens("expired-access", "refresh-token");
    const fetchMock = vi.fn();
    mockFetch(fetchMock);

    const request = new Request("http://localhost/api/protected");
    const response = new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
    const result = (await handleUnauthorizedResponse(
      request,
      createOptions({ authRefreshAttempted: true }),
      response,
      { retryCount: 0 },
    )) as Response;

    expect(result.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

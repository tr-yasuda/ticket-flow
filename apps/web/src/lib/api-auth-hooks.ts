import { type BeforeRequestHook, type BeforeRetryHook } from "ky";

import { buildApiUrl } from "./api-base-url";
import { ApiError } from "./api-error";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "./token-storage";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

function extractTokens(
  body: unknown,
): Readonly<{ accessToken?: string; refreshToken?: string }> {
  if (!isRecord(body)) {
    return {};
  }
  if (body.success === true && isRecord(body.data)) {
    return {
      accessToken: isNonEmptyString(body.data.accessToken)
        ? body.data.accessToken
        : undefined,
      refreshToken: isNonEmptyString(body.data.refreshToken)
        ? body.data.refreshToken
        : undefined,
    };
  }
  return {
    accessToken: isNonEmptyString(body.accessToken)
      ? body.accessToken
      : undefined,
    refreshToken: isNonEmptyString(body.refreshToken)
      ? body.refreshToken
      : undefined,
  };
}

let refreshingPromise: Promise<
  Readonly<{ accessToken: string; refreshToken: string }>
> | null = null;

/**
 * リフレッシュトークンを使って新しいアクセストークンを取得する。
 *
 * このリクエストは ky / apiClient を使わず、グローバルの fetch を直接使う。
 * ky 経由で送ると beforeRequest / beforeRetry / afterResponse フックが再帰的に
 * 発火し、401 応答で無限にリフレッシュを繰り返す可能性があるため。
 */
async function performRefresh(): Promise<
  Readonly<{ accessToken: string; refreshToken: string }>
> {
  const token = getRefreshToken();
  if (token === null || token.trim() === "") {
    throw new ApiError("Refresh token is missing", 401);
  }

  if (refreshingPromise !== null) {
    return refreshingPromise;
  }

  refreshingPromise = (async () => {
    try {
      const response = await fetch(buildApiUrl("/auth/refresh"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new ApiError("Refresh failed", response.status);
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new ApiError("Invalid refresh response", 500);
      }

      const { accessToken, refreshToken } = extractTokens(body);
      if (accessToken === undefined || accessToken.trim() === "") {
        throw new ApiError("Invalid refresh response", 500);
      }
      return {
        accessToken,
        refreshToken: refreshToken ?? token,
      };
    } finally {
      refreshingPromise = null;
    }
  })();

  return refreshingPromise;
}

/**
 * @internal ky の beforeRequest hook として apiClient に登録する専用。
 *   単独で呼び出さないこと。
 */
export const addAuthHeader: BeforeRequestHook = (request) => {
  const token = getAccessToken();
  if (token === null || token.trim() === "") {
    return undefined;
  }
  const headers = new Headers(request.headers);
  if (headers.has("Authorization")) {
    return undefined;
  }
  headers.set("Authorization", `Bearer ${token}`);
  return new Request(request, { headers });
};

/**
 * @internal ky の beforeRetry hook として apiClient に登録する専用。
 *   単独で呼び出さないこと。
 */
export const refreshAccessToken: BeforeRetryHook = async ({
  request,
  retryCount,
}) => {
  if (retryCount !== 1) {
    return;
  }

  try {
    const { accessToken, refreshToken } = await performRefresh();
    setTokens(accessToken, refreshToken);
    const headers = new Headers(request.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);
    return new Request(request, { headers });
  } catch (error) {
    clearTokens();
    throw error;
  }
};

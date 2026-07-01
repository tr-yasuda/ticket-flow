import ky, { type AfterResponseHook, type BeforeRequestHook } from "ky";

import { buildApiUrl } from "./api-base-url";
import { ApiError, handleApiErrorResponse } from "./api-error";
import { isRecord } from "./api-response";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "./token-storage";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
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
 * ky 経由で送ると beforeRequest / afterResponse フックが再帰的に
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

function isRefreshRequest(request: Request): boolean {
  return (
    new URL(request.url).pathname ===
    new URL(buildApiUrl("/auth/refresh"), "http://localhost").pathname
  );
}

function hasRefreshBeenAttempted(context: unknown): boolean {
  return isRecord(context) && context.authRefreshAttempted === true;
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
 * @internal ky の afterResponse hook として apiClient に登録する専用。
 *   単独で呼び出さないこと。
 */
export const handleUnauthorizedResponse: AfterResponseHook = async (
  request,
  options,
  response,
) => {
  if (response.status !== 401) {
    return response;
  }

  if (isRefreshRequest(request)) {
    clearTokens();
    return response;
  }

  if (hasRefreshBeenAttempted(options.context)) {
    return response;
  }

  const refreshToken = getRefreshToken();
  if (refreshToken === null || refreshToken.trim() === "") {
    clearTokens();
    return response;
  }

  const context = isRecord(options.context)
    ? options.context
    : ({} as Record<string, unknown>);
  context.authRefreshAttempted = true;

  let accessToken: string;
  let newRefreshToken: string;
  try {
    const tokens = await performRefresh();
    accessToken = tokens.accessToken;
    newRefreshToken = tokens.refreshToken;
  } catch (error) {
    clearTokens();
    throw error;
  }

  setTokens(accessToken, newRefreshToken);

  const headers = new Headers(request.headers);
  // 古い Authorization を削除し、addAuthHeader 経由で新しいトークンを付与する。
  // これにより、テスト環境の Headers 実装で Authorization が重複するのを防ぐ。
  headers.delete("Authorization");

  // 元の Request を再構築し、再送時に ky のデフォルト hooks を適用する。
  // options に含まれる headers / body は新しい Request に統合済みのため除外する。
  const { headers: _headers, body: _body, ...retryOptions } = options;

  return ky(new Request(request, { headers }), {
    ...retryOptions,
    hooks: {
      beforeRequest: [addAuthHeader],
      afterResponse: [handleUnauthorizedResponse, handleApiErrorResponse],
    },
    retry: { limit: 0 },
  });
};

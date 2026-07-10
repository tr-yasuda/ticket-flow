import { refreshTokenResponseSchema } from "@ticket-flow/shared";
import ky, { type AfterResponseHook, type BeforeRequestHook } from "ky";
import { z } from "zod";

import { buildApiUrl } from "./api-base-url";
import { ApiError, handleApiErrorResponse } from "./api-error";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "./token-storage";

const refreshTokenWrappedResponseSchema = z.object({
  success: z.literal(true),
  data: refreshTokenResponseSchema,
});

const refreshContextSchema = z.object({
  authRefreshAttempted: z.literal(true),
});

function extractTokens(
  body: unknown,
): Readonly<{ accessToken?: string; refreshToken?: string }> {
  const wrappedResult = refreshTokenWrappedResponseSchema.safeParse(body);
  if (wrappedResult.success) {
    return wrappedResult.data.data;
  }

  const directResult = refreshTokenResponseSchema.safeParse(body);
  if (directResult.success) {
    return directResult.data;
  }

  return {};
}

const REFRESH_TIMEOUT_MS = 30_000;

let refreshingPromise: Promise<
  Readonly<{ accessToken: string; refreshToken: string }>
> | null = null;

/**
 * リフレッシュトークンを使って新しいアクセストークンを取得する。
 *
 * このリクエストは ky / apiClient を使わず、グローバルの fetch を直接使う。
 * ky 経由で送ると beforeRequest / afterResponse フックが再帰的に
 * 発火し、401 応答で無限にリフレッシュを繰り返す可能性があるため。
 *
 * 同一時刻に複数の 401 が発生した場合、リフレッシュは 1 回に集約される。
 * そのためリフレッシュ fetch 自体は呼び出し元の AbortSignal とは別に
 * タイムアウト制御され、呼び出し元は集約された Promise の待機を
 * 個別にキャンセルできる。
 */
async function performRefresh(
  signal?: AbortSignal,
): Promise<Readonly<{ accessToken: string; refreshToken: string }>> {
  const token = getRefreshToken();
  if (token === null || token.trim() === "") {
    throw new ApiError("Refresh token is missing", 401);
  }

  if (refreshingPromise === null) {
    refreshingPromise = (async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        REFRESH_TIMEOUT_MS,
      );

      try {
        const response = await fetch(buildApiUrl("/auth/refresh"), {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
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
        clearTimeout(timeoutId);
      }
    })();
  }

  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  if (signal === undefined) {
    return refreshingPromise;
  }

  return Promise.race([
    refreshingPromise,
    new Promise<never>((_, reject) => {
      signal.addEventListener(
        "abort",
        () => reject(new DOMException("Aborted", "AbortError")),
        { once: true },
      );
    }),
  ]);
}

function isRefreshRequest(request: Request): boolean {
  return (
    new URL(request.url).pathname ===
    new URL(buildApiUrl("/auth/refresh"), "http://localhost").pathname
  );
}

function hasRefreshBeenAttempted(context: unknown): boolean {
  return refreshContextSchema.safeParse(context).success;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
    const tokens = await performRefresh(options.signal ?? undefined);
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

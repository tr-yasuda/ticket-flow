import { type ApiErrorResponse } from "@ticket-flow/shared";
import ky, { type AfterResponseHook, type BeforeRequestHook } from "ky";

import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "./token-storage";

export type ApiErrorDetail = Readonly<{
  field: string;
  message: string;
}>;

function isApiErrorDetail(value: unknown): value is ApiErrorDetail {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).field === "string" &&
    typeof (value as Record<string, unknown>).message === "string"
  );
}

function parseDetails(
  value: unknown,
): ReadonlyArray<ApiErrorDetail> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const details = value.filter(isApiErrorDetail);
  return details.length > 0 ? details : undefined;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: ReadonlyArray<ApiErrorDetail>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractTokens(
  body: unknown,
): Readonly<{ accessToken?: string; refreshToken?: string }> {
  if (!isRecord(body)) {
    return {};
  }
  if (body.success === true && isRecord(body.data)) {
    return {
      accessToken:
        typeof body.data.accessToken === "string"
          ? body.data.accessToken
          : undefined,
      refreshToken:
        typeof body.data.refreshToken === "string"
          ? body.data.refreshToken
          : undefined,
    };
  }
  return {
    accessToken:
      typeof body.accessToken === "string" ? body.accessToken : undefined,
    refreshToken:
      typeof body.refreshToken === "string" ? body.refreshToken : undefined,
  };
}

let refreshingPromise: Promise<
  Readonly<{ accessToken: string; refreshToken: string }>
> | null = null;

function isApiErrorResponseLike(body: unknown): body is ApiErrorResponse {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const response = body as { success?: unknown; error?: unknown };
  if (response.success !== false) {
    return false;
  }
  if (typeof response.error !== "object" || response.error === null) {
    return false;
  }
  const error = response.error as { message?: unknown };
  return typeof error.message === "string";
}

function getApiBaseUrl(): string {
  const value = import.meta.env.VITE_API_BASE_URL?.trim();
  // 空文字列も未設定と同様に扱い、"/api" にフォールバックする。
  // ?? では空文字列はフォールバック対象にならないため || を使用している。
  return value || "/api";
}

function buildApiUrl(path: string): string {
  const base = getApiBaseUrl();
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

async function performRefresh(): Promise<
  Readonly<{ accessToken: string; refreshToken: string }>
> {
  const token = getRefreshToken();
  if (token === null) {
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
      if (accessToken === undefined || accessToken === "") {
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

const addAuthHeader: BeforeRequestHook = (request) => {
  const headers = new Headers(request.headers);
  const token = getAccessToken();
  if (token === null) {
    if (headers.has("Authorization")) {
      return new Request(request, { headers });
    }
    return;
  }
  if (!headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return new Request(request, { headers });
};

function isRefreshRequest(request: Request): boolean {
  return (
    new URL(request.url).pathname ===
    new URL(buildApiUrl("/auth/refresh"), "http://localhost").pathname
  );
}

function hasRefreshBeenAttempted(options: Record<string, unknown>): boolean {
  return options.authRefreshAttempted === true;
}

const handleUnauthorizedResponse: AfterResponseHook = async (
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

  options.context.authRefreshAttempted = true;

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
    hooks: defaultHooks,
    retry: { limit: 0 },
  });
};

const handleErrorResponse: AfterResponseHook = async (
  _request,
  _options,
  response,
) => {
  if (response.ok) {
    return response;
  }

  const cloned = response.clone();
  try {
    const body = (await cloned.json()) as unknown;
    if (isApiErrorResponseLike(body)) {
      throw new ApiError(
        body.error.message,
        response.status,
        parseDetails(body.error.details),
      );
    }
    const legacyBody = body as { error?: unknown; details?: unknown };
    const message =
      typeof legacyBody.error === "string"
        ? legacyBody.error
        : "Request failed";
    throw new ApiError(
      message,
      response.status,
      parseDetails(legacyBody.details),
    );
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError("Request failed", response.status);
  }
};

const defaultHooks = {
  beforeRequest: [addAuthHeader],
  afterResponse: [handleUnauthorizedResponse, handleErrorResponse],
};

const RETRYABLE_HTTP_STATUSES = [408, 429, 500, 502, 503, 504] as const;

export const apiClient = ky.create({
  prefixUrl: getApiBaseUrl(),
  hooks: defaultHooks,
  retry: {
    limit: 1,
    methods: ["get"],
    shouldRetry: ({ error }) => {
      if (error instanceof TypeError) {
        return true;
      }
      return (
        error instanceof ApiError &&
        RETRYABLE_HTTP_STATUSES.includes(
          error.status as (typeof RETRYABLE_HTTP_STATUSES)[number],
        )
      );
    },
  },
});

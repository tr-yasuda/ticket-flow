import ky, {
  type AfterResponseHook,
  type BeforeRequestHook,
  type BeforeRetryHook,
} from "ky";

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

type RefreshResponse = Readonly<{ accessToken: string }>;

let refreshingPromise: Promise<string> | null = null;

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

async function performRefresh(): Promise<string> {
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

      let body: RefreshResponse;
      try {
        body = (await response.json()) as RefreshResponse;
      } catch {
        throw new ApiError("Invalid refresh response", 500);
      }
      if (
        typeof body !== "object" ||
        body === null ||
        typeof body.accessToken !== "string" ||
        body.accessToken === ""
      ) {
        throw new ApiError("Invalid refresh response", 500);
      }
      return body.accessToken;
    } finally {
      refreshingPromise = null;
    }
  })();

  return refreshingPromise;
}

const addAuthHeader: BeforeRequestHook = (request) => {
  const token = getAccessToken();
  if (token === null) {
    return;
  }
  const headers = new Headers(request.headers);
  if (!headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
    return new Request(request, { headers });
  }
};

const refreshAccessToken: BeforeRetryHook = async ({ request, retryCount }) => {
  if (retryCount !== 1) {
    return;
  }

  try {
    const newAccessToken = await performRefresh();
    const refreshToken = getRefreshToken();
    if (refreshToken === null) {
      throw new ApiError("Refresh token is missing", 401);
    }
    setTokens(newAccessToken, refreshToken);
    const headers = new Headers(request.headers);
    headers.set("Authorization", `Bearer ${newAccessToken}`);
    return new Request(request, { headers });
  } catch (error) {
    clearTokens();
    throw error;
  }
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
    const body = (await cloned.json()) as {
      error?: unknown;
      details?: unknown;
    };
    const message =
      typeof body.error === "string" ? body.error : "Request failed";
    throw new ApiError(message, response.status, parseDetails(body.details));
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError("Request failed", response.status);
  }
};

export const apiClient = ky.create({
  prefixUrl: getApiBaseUrl(),
  hooks: {
    beforeRequest: [addAuthHeader],
    beforeRetry: [refreshAccessToken],
    afterResponse: [handleErrorResponse],
  },
  retry: {
    limit: 1,
    methods: ["get", "post", "put", "patch", "delete"],
    shouldRetry: ({ error, retryCount }) => {
      if (retryCount > 1) {
        return false;
      }
      return (
        error instanceof ApiError &&
        error.status === 401 &&
        getRefreshToken() !== null
      );
    },
  },
});

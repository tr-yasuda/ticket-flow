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

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

type RefreshResponse = Readonly<{ accessToken: string }>;

let refreshingPromise: Promise<string> | null = null;

function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? "/api";
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
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new ApiError("Refresh failed", response.status);
      }

      const body = (await response.json()) as RefreshResponse;
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

const addAuthHeader: BeforeRequestHook = (request, options) => {
  const token = getAccessToken();
  const headers = new Headers(options.headers);
  if (token !== null && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
    return new Request(request, { headers });
  }
};

const refreshAccessToken: BeforeRetryHook = async ({
  request,
  options,
  retryCount,
}) => {
  if (retryCount !== 1) {
    return;
  }

  try {
    const newAccessToken = await performRefresh();
    const refreshToken = getRefreshToken();
    if (refreshToken === null) {
      clearTokens();
      throw new ApiError("Refresh token is missing", 401);
    }
    setTokens(newAccessToken, refreshToken);
    const headers = new Headers(options.headers);
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
    const body = (await cloned.json()) as { error?: string };
    throw new ApiError(body.error ?? "Request failed", response.status);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError("Request failed", response.status);
  }
};

export const apiClient = ky.create({
  prefixUrl: getApiBaseUrl(),
  headers: {
    "Content-Type": "application/json",
  },
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
      return error instanceof ApiError && error.status === 401;
    },
  },
});

import { type ApiSuccessResponse } from "@ticket-flow/shared";

import { apiClient } from "./api-client";
import { clearTokens, getRefreshToken, setTokens } from "./token-storage";

export type LoginInput = Readonly<{ email: string; password: string }>;
export type RegisterInput = Readonly<{ email: string; password: string }>;

export type CurrentUser = Readonly<{
  id: string;
  email: string;
}>;

export type AuthResponse = Readonly<{
  user: CurrentUser;
  accessToken: string;
  refreshToken: string;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCurrentUser(value: unknown): value is CurrentUser {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.email === "string"
  );
}

function isAuthResponse(value: unknown): value is AuthResponse {
  return (
    isRecord(value) &&
    isCurrentUser(value.user) &&
    typeof value.accessToken === "string" &&
    typeof value.refreshToken === "string"
  );
}

function isApiSuccessResponse<T>(
  value: unknown,
  isData: (data: unknown) => data is T,
): value is ApiSuccessResponse<T> {
  return (
    isRecord(value) &&
    value.success === true &&
    isRecord(value.data) &&
    isData(value.data)
  );
}

function extractAuthResponse(body: unknown): AuthResponse {
  const data = isApiSuccessResponse(body, isAuthResponse) ? body.data : body;
  if (!isAuthResponse(data)) {
    throw new Error("Invalid auth response");
  }
  return data;
}

function extractCurrentUser(body: unknown): CurrentUser {
  const data = isApiSuccessResponse(
    body,
    (value): value is { user: CurrentUser } =>
      isRecord(value) && isCurrentUser(value.user),
  )
    ? body.data
    : body;
  if (!isRecord(data) || !isCurrentUser(data.user)) {
    throw new Error("Invalid current user response");
  }
  return data.user;
}

async function postAuth(
  endpoint: "auth/login" | "auth/register",
  input: LoginInput | RegisterInput,
): Promise<AuthResponse> {
  const body = await apiClient.post(endpoint, { json: input }).json<unknown>();
  const data = extractAuthResponse(body);
  setTokens(data.accessToken, data.refreshToken);
  return data;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const body = await apiClient.get("me").json<unknown>();
  return extractCurrentUser(body);
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  return postAuth("auth/register", input);
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  return postAuth("auth/login", input);
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (refreshToken === null) {
    clearTokens();
    return;
  }

  try {
    await apiClient.post("auth/logout", {
      headers: { Authorization: `Bearer ${refreshToken}` },
    });
  } finally {
    clearTokens();
  }
}

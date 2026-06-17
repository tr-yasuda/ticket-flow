import { type ApiSuccessResponse } from "@ticket-flow/shared";

import { apiClient } from "./api-client";
import { clearTokens, getRefreshToken, setTokens } from "./token-storage";

export type LoginInput = Readonly<{ email: string; password: string }>;
export type RegisterInput = Readonly<{ email: string; password: string }>;

type AuthResponse = Readonly<{
  user: { id: string; email: string };
  accessToken: string;
  refreshToken: string;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isUser(value: unknown): value is { id: string; email: string } {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.email === "string"
  );
}

function isAuthResponse(value: unknown): value is AuthResponse {
  return (
    isRecord(value) &&
    isUser(value.user) &&
    typeof value.accessToken === "string" &&
    typeof value.refreshToken === "string"
  );
}

function isApiSuccessResponse(
  value: unknown,
): value is ApiSuccessResponse<AuthResponse> {
  return (
    isRecord(value) &&
    value.success === true &&
    isRecord(value.data) &&
    isAuthResponse(value.data)
  );
}

async function postAuth(
  endpoint: "auth/login" | "auth/register",
  input: LoginInput | RegisterInput,
): Promise<AuthResponse> {
  const body = await apiClient
    .post(endpoint, { json: input })
    .json<AuthResponse | ApiSuccessResponse<AuthResponse>>();
  const data = isApiSuccessResponse(body) ? body.data : body;
  setTokens(data.accessToken, data.refreshToken);
  return data;
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

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

async function postAuth(
  endpoint: "auth/login" | "auth/register",
  input: LoginInput | RegisterInput,
): Promise<AuthResponse> {
  const response = await apiClient
    .post(endpoint, { json: input })
    .json<ApiSuccessResponse<AuthResponse>>();
  setTokens(response.data.accessToken, response.data.refreshToken);
  return response.data;
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

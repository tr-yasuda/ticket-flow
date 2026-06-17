import { apiClient } from "./api-client";
import { clearTokens, getRefreshToken, setTokens } from "./token-storage";

export type LoginInput = Readonly<{ email: string; password: string }>;
export type RegisterInput = Readonly<{ email: string; password: string }>;

type AuthResponse = Readonly<{
  user: { id: string; email: string };
  accessToken: string;
  refreshToken: string;
}>;

export async function register(input: RegisterInput): Promise<AuthResponse> {
  return apiClient.post("auth/register", { json: input }).json<AuthResponse>();
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const response = await apiClient
    .post("auth/login", { json: input })
    .json<AuthResponse>();
  setTokens(response.accessToken, response.refreshToken);
  return response;
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (refreshToken === null) {
    clearTokens();
    return;
  }

  await apiClient.post("auth/logout", {
    headers: { Authorization: `Bearer ${refreshToken}` },
  });
  clearTokens();
}

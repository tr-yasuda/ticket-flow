import {
  authResponseSchema,
  currentUserSchema,
  type AuthResponse,
  type CurrentUser,
} from "@ticket-flow/shared";
import { z } from "zod";

import { apiClient } from "./api-client";
import { extractData } from "./api-response";
import { clearTokens, getRefreshToken, setTokens } from "./token-storage";

export type LoginInput = Readonly<{ email: string; password: string }>;
export type RegisterInput = Readonly<{ email: string; password: string }>;

export type { AuthResponse, CurrentUser };

const currentUserEnvelopeSchema = z.object({ user: currentUserSchema });

async function postAuth(
  endpoint: "auth/login" | "auth/register",
  input: LoginInput | RegisterInput,
): Promise<AuthResponse> {
  const body = await apiClient.post(endpoint, { json: input }).json<unknown>();
  const data = extractData(body, authResponseSchema, "Invalid auth response");
  setTokens(data.accessToken, data.refreshToken);
  return data;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const body = await apiClient.get("me").json<unknown>();
  const data = extractData(
    body,
    currentUserEnvelopeSchema,
    "Invalid current user response",
  );
  return data.user;
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

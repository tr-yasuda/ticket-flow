import type { RefreshTokenRepository } from "../domain/refresh-token-repository.js";

export type RefreshTokenInput = Readonly<{ refreshToken: string }>;

export type RefreshTokenSuccess = Readonly<{ accessToken: string }>;

export type RefreshTokenError = Readonly<{
  type: "invalid-token";
  message: string;
}>;

export type RefreshTokenResult =
  | { success: true; data: RefreshTokenSuccess }
  | { success: false; error: RefreshTokenError };

export type RefreshTokenDependencies = Readonly<{
  refreshTokenRepository: RefreshTokenRepository;
  verifyRefreshToken: (token: string) => Promise<{ userId: string }>;
  generateAccessToken: (userId: string) => Promise<string>;
  hashRefreshToken: (token: string) => string;
}>;

export async function refreshAccessToken(
  input: RefreshTokenInput,
  deps: RefreshTokenDependencies,
): Promise<RefreshTokenResult> {
  try {
    await deps.verifyRefreshToken(input.refreshToken);
  } catch {
    return {
      success: false,
      error: {
        type: "invalid-token",
        message: "Invalid refresh token",
      },
    };
  }

  const tokenHash = deps.hashRefreshToken(input.refreshToken);
  const storedToken =
    await deps.refreshTokenRepository.findByTokenHash(tokenHash);
  if (storedToken === null) {
    return {
      success: false,
      error: {
        type: "invalid-token",
        message: "Invalid refresh token",
      },
    };
  }

  const accessToken = await deps.generateAccessToken(storedToken.userId);
  return { success: true, data: { accessToken } };
}

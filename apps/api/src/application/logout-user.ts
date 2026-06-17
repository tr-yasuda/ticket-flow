import type { RefreshTokenRepository } from "../domain/refresh-token-repository.js";
import { hashRefreshToken } from "../domain/refresh-token.js";

export type LogoutUserInput = Readonly<{
  refreshToken: string;
}>;

export type LogoutUserResult =
  | { success: true }
  | { success: false; error: { type: "invalid-token"; message: string } };

export type LogoutUserDependencies = Readonly<{
  refreshTokenRepository: RefreshTokenRepository;
  verifyRefreshToken: (token: string) => Promise<{ userId: string }>;
}>;

export async function logoutUser(
  input: LogoutUserInput,
  deps: LogoutUserDependencies,
): Promise<LogoutUserResult> {
  try {
    await deps.verifyRefreshToken(input.refreshToken);
  } catch (error) {
    return {
      success: false,
      error: {
        type: "invalid-token",
        message:
          error instanceof Error ? error.message : "Invalid refresh token",
      },
    };
  }

  const tokenHash = hashRefreshToken(input.refreshToken);
  await deps.refreshTokenRepository.delete(tokenHash);

  return { success: true };
}

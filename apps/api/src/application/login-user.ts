import type { RefreshTokenRepository } from "../domain/refresh-token-repository.js";
import type { UserRepository } from "../domain/user-repository.js";
import { validateEmail } from "../domain/user.js";
import type { User } from "../domain/user.js";

export type LoginUserInput = Readonly<{
  email: string;
  password: string;
}>;

export type LoginUserSuccess = Readonly<{
  user: User;
  accessToken: string;
  refreshToken: string;
}>;

export type LoginUserError = Readonly<
  | { type: "invalid-email"; message: string }
  | { type: "authentication-failed"; message: string }
>;

export type LoginUserResult =
  | { success: true; data: LoginUserSuccess }
  | { success: false; error: LoginUserError };

export type LoginUserDependencies = Readonly<{
  userRepository: UserRepository;
  refreshTokenRepository: RefreshTokenRepository;
  verifyPassword: (
    plainPassword: string,
    hashedPassword: string,
  ) => Promise<boolean>;
  generateAccessToken: (userId: string) => Promise<string>;
  generateRefreshToken: (userId: string) => Promise<string>;
  hashRefreshToken: (token: string) => string;
}>;

export async function loginUser(
  input: LoginUserInput,
  deps: LoginUserDependencies,
): Promise<LoginUserResult> {
  let normalizedEmail: string;
  try {
    normalizedEmail = validateEmail(input.email);
  } catch (error) {
    return {
      success: false,
      error: {
        type: "invalid-email",
        message:
          error instanceof Error ? error.message : "Invalid email address",
      },
    };
  }

  const user = await deps.userRepository.findByEmail(normalizedEmail);
  if (user === null) {
    return {
      success: false,
      error: {
        type: "authentication-failed",
        message: "Invalid email or password",
      },
    };
  }

  const isPasswordValid = await deps.verifyPassword(
    input.password,
    user.passwordHash,
  );
  if (!isPasswordValid) {
    return {
      success: false,
      error: {
        type: "authentication-failed",
        message: "Invalid email or password",
      },
    };
  }

  const [accessToken, refreshToken] = await Promise.all([
    deps.generateAccessToken(user.id),
    deps.generateRefreshToken(user.id),
  ]);

  await deps.refreshTokenRepository.save({
    tokenHash: deps.hashRefreshToken(refreshToken),
    userId: user.id,
  });

  return {
    success: true,
    data: {
      user,
      accessToken,
      refreshToken,
    },
  };
}

import { validatePassword } from "../domain/password.js";
import type { UserRepository } from "../domain/user-repository.js";
import { createUser } from "../domain/user.js";
import type { User } from "../domain/user.js";

export type RegisterUserInput = Readonly<{
  email: string;
  password: string;
}>;

export type RegisterUserSuccess = Readonly<{
  user: User;
  accessToken: string;
  refreshToken: string;
}>;

export type RegisterUserError = Readonly<
  | { type: "invalid-email"; message: string }
  | { type: "invalid-password"; message: string }
  | { type: "email-already-exists"; message: string }
>;

export type RegisterUserResult =
  | { success: true; data: RegisterUserSuccess }
  | { success: false; error: RegisterUserError };

export type RegisterUserDependencies = Readonly<{
  userRepository: UserRepository;
  hashPassword: (plainPassword: string) => Promise<string>;
  generateAccessToken: (userId: string) => Promise<string>;
  generateRefreshToken: (userId: string) => Promise<string>;
}>;

export async function registerUser(
  input: RegisterUserInput,
  deps: RegisterUserDependencies,
): Promise<RegisterUserResult> {
  const passwordValidation = validatePassword(input.password);
  if (!passwordValidation.valid) {
    return {
      success: false,
      error: {
        type: "invalid-password",
        message: passwordValidation.reason,
      },
    };
  }

  const normalizedEmail = input.email.toLowerCase();
  const existingUser = await deps.userRepository.findByEmail(normalizedEmail);
  if (existingUser !== null) {
    return {
      success: false,
      error: {
        type: "email-already-exists",
        message: "Email already exists",
      },
    };
  }

  const passwordHash = await deps.hashPassword(input.password);

  let user: User;
  try {
    user = createUser(normalizedEmail, passwordHash);
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

  await deps.userRepository.save(user);

  const [accessToken, refreshToken] = await Promise.all([
    deps.generateAccessToken(user.id),
    deps.generateRefreshToken(user.id),
  ]);

  return {
    success: true,
    data: {
      user,
      accessToken,
      refreshToken,
    },
  };
}

import { Prisma, type PrismaClient } from "@prisma/client";

import {
  hashPassword,
  verifyPassword,
  validatePassword,
} from "../domain/password.js";
import { hashRefreshToken } from "../domain/refresh-token.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../domain/token.js";
import { createUser, validateEmail } from "../domain/user.js";
import { env } from "../lib/env.js";
import { prisma } from "../lib/prisma.js";

const tokenConfig = {
  secret: env.JWT_SECRET,
  accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
  refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
};

export type RegisterUserInput = Readonly<{
  email: string;
  password: string;
}>;

export type AuthSuccess = Readonly<{
  user: { id: string; email: string };
  accessToken: string;
  refreshToken: string;
}>;

export type RegisterUserResult =
  | { success: true; data: AuthSuccess }
  | {
      success: false;
      error:
        | { type: "invalid-email"; message: string }
        | { type: "invalid-password"; message: string }
        | { type: "email-already-exists"; message: string };
    };

export async function registerUser(
  input: RegisterUserInput,
  db: PrismaClient = prisma,
): Promise<RegisterUserResult> {
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

  const existingUser = await db.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existingUser !== null) {
    return {
      success: false,
      error: {
        type: "email-already-exists",
        message: "Email already exists",
      },
    };
  }

  const passwordHash = await hashPassword(input.password);
  const user = createUser(normalizedEmail, passwordHash);

  try {
    await db.user.create({
      data: {
        id: user.id,
        email: user.email,
        passwordHash: user.passwordHash,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false,
        error: {
          type: "email-already-exists",
          message: "Email already exists",
        },
      };
    }
    throw error;
  }

  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken({ userId: user.id }, tokenConfig),
    generateRefreshToken({ userId: user.id }, tokenConfig),
  ]);

  await db.refreshToken.create({
    data: {
      tokenHash: hashRefreshToken(refreshToken),
      userId: user.id,
    },
  });

  return {
    success: true,
    data: {
      user: { id: user.id, email: user.email },
      accessToken,
      refreshToken,
    },
  };
}

export type LoginUserInput = Readonly<{
  email: string;
  password: string;
}>;

export type LoginUserResult =
  | { success: true; data: AuthSuccess }
  | {
      success: false;
      error:
        | { type: "invalid-email"; message: string }
        | { type: "authentication-failed"; message: string };
    };

export async function loginUser(
  input: LoginUserInput,
  db: PrismaClient = prisma,
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

  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (user === null) {
    return {
      success: false,
      error: {
        type: "authentication-failed",
        message: "Invalid email or password",
      },
    };
  }

  const isPasswordValid = await verifyPassword(
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
    generateAccessToken({ userId: user.id }, tokenConfig),
    generateRefreshToken({ userId: user.id }, tokenConfig),
  ]);

  await db.refreshToken.create({
    data: {
      tokenHash: hashRefreshToken(refreshToken),
      userId: user.id,
    },
  });

  return {
    success: true,
    data: {
      user: { id: user.id, email: user.email },
      accessToken,
      refreshToken,
    },
  };
}

export type LogoutUserInput = Readonly<{
  refreshToken: string;
}>;

export type LogoutUserResult =
  | { success: true }
  | { success: false; error: { type: "invalid-token"; message: string } };

export async function logoutUser(
  input: LogoutUserInput,
  db: PrismaClient = prisma,
): Promise<LogoutUserResult> {
  try {
    await verifyRefreshToken(input.refreshToken, tokenConfig);
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

  try {
    await db.refreshToken.delete({ where: { tokenHash } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return { success: true };
    }
    throw error;
  }

  return { success: true };
}

export type RefreshAccessTokenInput = Readonly<{
  refreshToken: string;
}>;

export type RefreshAccessTokenResult =
  | { success: true; data: { accessToken: string } }
  | { success: false; error: { type: "invalid-token"; message: string } };

export async function refreshAccessToken(
  input: RefreshAccessTokenInput,
  db: PrismaClient = prisma,
): Promise<RefreshAccessTokenResult> {
  try {
    await verifyRefreshToken(input.refreshToken, tokenConfig);
  } catch {
    return {
      success: false,
      error: {
        type: "invalid-token",
        message: "Invalid refresh token",
      },
    };
  }

  const tokenHash = hashRefreshToken(input.refreshToken);
  const storedToken = await db.refreshToken.findUnique({
    where: { tokenHash },
  });
  if (storedToken === null) {
    return {
      success: false,
      error: {
        type: "invalid-token",
        message: "Invalid refresh token",
      },
    };
  }

  const accessToken = await generateAccessToken(
    { userId: storedToken.userId },
    tokenConfig,
  );
  return { success: true, data: { accessToken } };
}

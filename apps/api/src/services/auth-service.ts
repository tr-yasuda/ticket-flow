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
import { isUniqueConstraintTarget } from "../lib/prisma-error.js";
import { prisma } from "../lib/prisma.js";
import { tokenConfig } from "../lib/token-config.js";

const MAX_REFRESH_TOKEN_HASH_ATTEMPTS = 5;

export class InvalidEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidEmailError";
  }
}

export class InvalidPasswordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPasswordError";
  }
}

export class DuplicateEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateEmailError";
  }
}

export type RegisterUserInput = Readonly<{
  email: string;
  password: string;
  name?: string;
}>;

export type AuthSuccess = Readonly<{
  user: { id: string; email: string; name: string | null };
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

export async function createRegisteredUserWithTokens(
  input: RegisterUserInput,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<AuthSuccess> {
  let normalizedEmail: string;
  try {
    normalizedEmail = validateEmail(input.email);
  } catch (error) {
    throw new InvalidEmailError(
      error instanceof Error ? error.message : "Invalid email address",
    );
  }

  const passwordValidation = validatePassword(input.password);
  if (!passwordValidation.valid) {
    throw new InvalidPasswordError(passwordValidation.reason);
  }

  const existingUser = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });
  if (existingUser !== null) {
    throw new DuplicateEmailError("Email already exists");
  }

  const passwordHash = await hashPassword(input.password);
  const user = createUser(normalizedEmail, passwordHash, input.name ?? null);

  await db.user.create({
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      passwordHash: user.passwordHash,
    },
  });

  const accessToken = await generateAccessToken(
    { userId: user.id },
    tokenConfig,
  );

  let refreshToken: string | undefined;
  for (let attempt = 1; attempt <= MAX_REFRESH_TOKEN_HASH_ATTEMPTS; attempt++) {
    refreshToken = await generateRefreshToken({ userId: user.id }, tokenConfig);
    try {
      await db.refreshToken.create({
        data: {
          tokenHash: hashRefreshToken(refreshToken),
          userId: user.id,
        },
      });
      break;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        isUniqueConstraintTarget(error, "token_hash") &&
        attempt < MAX_REFRESH_TOKEN_HASH_ATTEMPTS
      ) {
        // 極めて稀なトークンハッシュ衝突。リフレッシュトークンのみ再生成して再試行する。
        continue;
      }
      throw error;
    }
  }
  if (refreshToken === undefined) {
    throw new Error(
      "リフレッシュトークンの一意なハッシュを生成できませんでした",
    );
  }

  return {
    user: { id: user.id, email: user.email, name: user.name },
    accessToken,
    refreshToken,
  };
}

export async function registerUser(
  input: RegisterUserInput,
  db: PrismaClient = prisma,
): Promise<RegisterUserResult> {
  try {
    const { user, accessToken, refreshToken } = await db.$transaction(
      async (tx) => {
        return createRegisteredUserWithTokens(input, tx);
      },
    );

    return {
      success: true,
      data: {
        user,
        accessToken,
        refreshToken,
      },
    };
  } catch (error) {
    if (error instanceof InvalidEmailError) {
      return {
        success: false,
        error: { type: "invalid-email", message: error.message },
      };
    }
    if (error instanceof InvalidPasswordError) {
      return {
        success: false,
        error: { type: "invalid-password", message: error.message },
      };
    }
    if (error instanceof DuplicateEmailError) {
      return {
        success: false,
        error: { type: "email-already-exists", message: error.message },
      };
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      isUniqueConstraintTarget(error, "email")
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
    select: { id: true, email: true, name: true, passwordHash: true },
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

  const { accessToken, refreshToken } = await db.$transaction(async (tx) => {
    const [accessToken, refreshToken] = await Promise.all([
      generateAccessToken({ userId: user.id }, tokenConfig),
      generateRefreshToken({ userId: user.id }, tokenConfig),
    ]);

    await tx.refreshToken.create({
      data: {
        tokenHash: hashRefreshToken(refreshToken),
        userId: user.id,
      },
    });

    return { accessToken, refreshToken };
  });

  return {
    success: true,
    data: {
      user: { id: user.id, email: user.email, name: user.name },
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
  | { success: true; data: { accessToken: string; refreshToken: string } }
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

  const oldTokenHash = hashRefreshToken(input.refreshToken);
  const storedToken = await db.refreshToken.findUnique({
    where: { tokenHash: oldTokenHash },
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

  const user = await db.user.findUnique({
    where: { id: storedToken.userId },
  });
  if (user === null) {
    return {
      success: false,
      error: {
        type: "invalid-token",
        message: "Invalid refresh token",
      },
    };
  }

  try {
    const { accessToken, refreshToken } = await db.$transaction(async (tx) => {
      await tx.refreshToken.delete({ where: { tokenHash: oldTokenHash } });
      const [accessToken, refreshToken] = await Promise.all([
        generateAccessToken({ userId: user.id }, tokenConfig),
        generateRefreshToken({ userId: user.id }, tokenConfig),
      ]);
      await tx.refreshToken.create({
        data: {
          tokenHash: hashRefreshToken(refreshToken),
          userId: user.id,
        },
      });
      return { accessToken, refreshToken };
    });

    return { success: true, data: { accessToken, refreshToken } };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return {
        success: false,
        error: {
          type: "invalid-token",
          message: "Invalid refresh token",
        },
      };
    }
    throw error;
  }
}

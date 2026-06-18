import { randomUUID } from "node:crypto";

import { SignJWT, errors, jwtVerify } from "jose";

export type TokenPayload = Readonly<{
  userId: string;
}>;

export type TokenConfig = Readonly<{
  secret: string;
  accessExpiresIn: string;
  refreshExpiresIn: string;
}>;

type TokenType = "access" | "refresh";

function encodeSecret(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

async function signToken(
  payload: TokenPayload,
  tokenType: TokenType,
  secret: string,
  expiresIn: string,
): Promise<string> {
  return new SignJWT({ ...payload, tokenType })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setJti(randomUUID())
    .setExpirationTime(expiresIn)
    .sign(encodeSecret(secret));
}

async function verifyToken(
  token: string,
  expectedType: TokenType,
  secret: string,
): Promise<TokenPayload> {
  try {
    const { payload } = await jwtVerify(token, encodeSecret(secret), {
      algorithms: ["HS256"],
    });

    if (
      payload.tokenType !== expectedType ||
      typeof payload.userId !== "string"
    ) {
      throw new Error("Invalid token");
    }

    return { userId: payload.userId };
  } catch (error) {
    if (error instanceof errors.JWTExpired) {
      throw Object.assign(new Error("Token has expired"), { cause: error });
    }
    throw Object.assign(new Error("Invalid token"), { cause: error });
  }
}

export async function generateAccessToken(
  payload: TokenPayload,
  config: TokenConfig,
): Promise<string> {
  return signToken(payload, "access", config.secret, config.accessExpiresIn);
}

export async function verifyAccessToken(
  token: string,
  config: TokenConfig,
): Promise<TokenPayload> {
  return verifyToken(token, "access", config.secret);
}

export async function generateRefreshToken(
  payload: TokenPayload,
  config: TokenConfig,
): Promise<string> {
  return signToken(payload, "refresh", config.secret, config.refreshExpiresIn);
}

export async function verifyRefreshToken(
  token: string,
  config: TokenConfig,
): Promise<TokenPayload> {
  return verifyToken(token, "refresh", config.secret);
}

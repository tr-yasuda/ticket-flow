import { SignJWT, errors, jwtVerify } from "jose";

export type TokenPayload = Readonly<{
  userId: string;
}>;

export type TokenConfig = Readonly<{
  secret: string;
  accessExpiresIn: string;
  refreshExpiresIn: string;
}>;

function encodeSecret(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

async function signToken(
  payload: TokenPayload,
  secret: string,
  expiresIn: string,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(encodeSecret(secret));
}

async function verifyToken(
  token: string,
  secret: string,
): Promise<TokenPayload> {
  try {
    const { payload } = await jwtVerify(token, encodeSecret(secret));
    return { userId: payload.userId as string };
  } catch (error) {
    if (error instanceof errors.JWTExpired) {
      throw new Error("Token has expired");
    }
    throw new Error("Invalid token");
  }
}

export async function generateAccessToken(
  payload: TokenPayload,
  config: TokenConfig,
): Promise<string> {
  return signToken(payload, config.secret, config.accessExpiresIn);
}

export async function verifyAccessToken(
  token: string,
  config: TokenConfig,
): Promise<TokenPayload> {
  return verifyToken(token, config.secret);
}

export async function generateRefreshToken(
  payload: TokenPayload,
  config: TokenConfig,
): Promise<string> {
  return signToken(payload, config.secret, config.refreshExpiresIn);
}

export async function verifyRefreshToken(
  token: string,
  config: TokenConfig,
): Promise<TokenPayload> {
  return verifyToken(token, config.secret);
}

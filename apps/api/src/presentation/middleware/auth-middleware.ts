import type { Context, Next } from "hono";

declare module "hono" {
  interface ContextVariableMap {
    userId: string;
  }
}

export type AuthMiddlewareDependencies = Readonly<{
  verifyAccessToken: (token: string) => Promise<{ userId: string }>;
}>;

function extractBearerToken(authorization: string | undefined): string | null {
  if (authorization === undefined) {
    return null;
  }
  const trimmed = authorization.trim();
  const match = /^Bearer\s+(.+)$/i.exec(trimmed);
  if (match === null) {
    return null;
  }
  return match[1].trim();
}

export function createAuthMiddleware(deps: AuthMiddlewareDependencies) {
  return async (c: Context, next: Next) => {
    const token = extractBearerToken(c.req.header("Authorization"));
    if (token === null) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    try {
      const payload = await deps.verifyAccessToken(token);
      c.set("userId", payload.userId);
      await next();
    } catch {
      return c.json({ error: "Unauthorized" }, 401);
    }
  };
}

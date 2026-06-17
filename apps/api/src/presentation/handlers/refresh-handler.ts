import type { Context } from "hono";

import { refreshAccessToken } from "../../application/refresh-token.js";
import type { RefreshTokenDependencies } from "../../application/refresh-token.js";

function extractBearerToken(authorization: string | undefined): string | null {
  if (authorization === undefined) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match?.[1] ?? null;
}

export function createRefreshHandler(deps: RefreshTokenDependencies) {
  return async (c: Context) => {
    const token = extractBearerToken(c.req.header("Authorization"));
    if (token === null) {
      return c.json({ error: "Authorization header is required" }, 401);
    }

    const result = await refreshAccessToken({ refreshToken: token }, deps);
    if (!result.success) {
      return c.json({ error: result.error.message }, 401);
    }

    return c.json({ accessToken: result.data.accessToken }, 200);
  };
}

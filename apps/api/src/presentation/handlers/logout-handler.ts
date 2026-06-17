import type { Context } from "hono";

import { logoutUser } from "../../application/logout-user.js";
import type { LogoutUserDependencies } from "../../application/logout-user.js";

function extractBearerToken(authorization: string | undefined): string | null {
  if (authorization === undefined) {
    return null;
  }
  const trimmed = authorization.trim();
  const match = /^Bearer\s+(.+)$/i.exec(trimmed);
  if (match === null) {
    return null;
  }
  return match[1];
}

export function createLogoutHandler(deps: LogoutUserDependencies) {
  return async (c: Context) => {
    const token = extractBearerToken(c.req.header("Authorization"));

    if (token !== null) {
      await logoutUser({ refreshToken: token }, deps);
    }

    return c.body(null, 204);
  };
}

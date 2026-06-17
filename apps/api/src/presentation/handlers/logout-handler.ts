import type { Context } from "hono";

import { logoutUser } from "../../application/logout-user.js";
import type { LogoutUserDependencies } from "../../application/logout-user.js";
import { extractBearerToken } from "../extract-bearer-token.js";

export function createLogoutHandler(deps: LogoutUserDependencies) {
  return async (c: Context) => {
    const token = extractBearerToken(c.req.header("Authorization"));

    if (token !== null) {
      await logoutUser({ refreshToken: token }, deps);
    }

    return c.body(null, 204);
  };
}

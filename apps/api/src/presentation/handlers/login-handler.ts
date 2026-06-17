import type { Context } from "hono";

import { loginUser } from "../../application/login-user.js";
import type { LoginUserDependencies } from "../../application/login-user.js";

export function createLoginHandler(deps: LoginUserDependencies) {
  return async (c: Context) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid request body" }, 400);
    }

    if (
      typeof body !== "object" ||
      body === null ||
      typeof (body as Record<string, unknown>).email !== "string" ||
      typeof (body as Record<string, unknown>).password !== "string"
    ) {
      return c.json({ error: "Invalid request body" }, 400);
    }

    const result = await loginUser(
      {
        email: (body as Record<string, string>).email,
        password: (body as Record<string, string>).password,
      },
      deps,
    );

    if (!result.success) {
      const status = result.error.type === "invalid-email" ? 400 : 401;
      return c.json({ error: result.error.message }, status);
    }

    return c.json(
      {
        user: {
          id: result.data.user.id,
          email: result.data.user.email,
        },
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken,
      },
      200,
    );
  };
}

import type { Context } from "hono";

import { registerUser } from "../../application/register-user.js";
import type { RegisterUserDependencies } from "../../application/register-user.js";

export function createRegisterHandler(deps: RegisterUserDependencies) {
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

    const result = await registerUser(
      {
        email: (body as Record<string, string>).email,
        password: (body as Record<string, string>).password,
      },
      deps,
    );

    if (!result.success) {
      const status = result.error.type === "email-already-exists" ? 409 : 400;
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
      201,
    );
  };
}

import { loginInputSchema, type LoginInput } from "@ticket-flow/shared";
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

    const parseResult = loginInputSchema.safeParse(body);
    if (!parseResult.success) {
      const details = parseResult.error.issues
        .map((issue) => ({
          field: issue.path[0],
          message: issue.message,
        }))
        .filter(
          (detail): detail is { field: string; message: string } =>
            typeof detail.field === "string",
        );
      return c.json(
        {
          error: "入力内容を確認してください",
          details,
        },
        400,
      );
    }

    const input: LoginInput = parseResult.data;

    const result = await loginUser(input, deps);

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

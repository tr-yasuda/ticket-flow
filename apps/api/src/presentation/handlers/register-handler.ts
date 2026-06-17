import { registerInputSchema, type RegisterInput } from "@ticket-flow/shared";
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

    const parseResult = registerInputSchema.safeParse(body);
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

    const input: RegisterInput = parseResult.data;

    const result = await registerUser(input, deps);

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

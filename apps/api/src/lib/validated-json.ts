import type { Context } from "hono";

export function getValidatedJson<T>(c: Context): T {
  return c.req.valid("json" as never) as T;
}

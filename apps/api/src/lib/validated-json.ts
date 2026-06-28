import type { Context } from "hono";

export function getValidatedJson<T>(c: Context): T {
  return c.req.valid("json" as never) as T;
}

export function getValidatedQuery<T>(c: Context): T {
  return c.req.valid("query" as never) as T;
}

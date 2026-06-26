import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

import { HttpStatus } from "../lib/http-status.js";

export function getRequiredContextValue(
  c: Context,
  key: "organizationId" | "userId",
): string {
  const value = c.get(key);
  if (typeof value !== "string" || value.length === 0) {
    const status =
      key === "userId" ? HttpStatus.UNAUTHORIZED : HttpStatus.FORBIDDEN;
    throw new HTTPException(status, {
      message: `Missing required context value: ${key}`,
    });
  }
  return value;
}

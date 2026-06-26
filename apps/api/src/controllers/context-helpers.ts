import type { Context } from "hono";

export function getRequiredContextValue(
  c: Context,
  key: "organizationId" | "userId",
): string {
  const value = c.get(key);
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required context value: ${key}`);
  }
  return value;
}

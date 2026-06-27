import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

import {
  isValidRole,
  type OrganizationMemberRole,
} from "../domain/organization-member.js";
import { HttpStatus } from "../lib/http-status.js";

export function getRequiredContextValue(
  c: Context,
  key: "organizationId" | "userId",
): string;
export function getRequiredContextValue(
  c: Context,
  key: "organizationRole",
): OrganizationMemberRole;
export function getRequiredContextValue(
  c: Context,
  key: "organizationId" | "organizationRole" | "userId",
): string | OrganizationMemberRole {
  const value = c.get(key);

  if (key === "organizationRole") {
    if (typeof value !== "string" || !isValidRole(value)) {
      throw new HTTPException(HttpStatus.FORBIDDEN, {
        message: `Missing or invalid required context value: ${key}`,
      });
    }
    return value;
  }

  if (typeof value !== "string" || value.length === 0) {
    const status =
      key === "userId" ? HttpStatus.UNAUTHORIZED : HttpStatus.FORBIDDEN;
    throw new HTTPException(status, {
      message: `Missing required context value: ${key}`,
    });
  }
  return value;
}

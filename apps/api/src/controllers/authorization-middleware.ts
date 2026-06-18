import { ApiErrorCode, createApiErrorResponse } from "@ticket-flow/shared";
import type { Context, Next } from "hono";

import type { OrganizationMemberRole } from "../domain/organization-member.js";
import { HttpStatus } from "../lib/http-status.js";

const FORBIDDEN_MESSAGE = "この操作を行う権限がありません";

const roleLevel: Record<OrganizationMemberRole, number> = {
  owner: 3,
  admin: 2,
  member: 1,
  viewer: 0,
};

export function createRequireRoleMiddleware(
  requiredRole: OrganizationMemberRole,
) {
  return async function requireRoleMiddleware(
    c: Context,
    next: Next,
  ): Promise<Response | undefined> {
    const currentRole = c.get("organizationRole");
    if (currentRole === undefined) {
      return c.json(
        createApiErrorResponse(ApiErrorCode.AUTH_FORBIDDEN, FORBIDDEN_MESSAGE),
        HttpStatus.FORBIDDEN,
      );
    }

    const currentLevel = roleLevel[currentRole];
    const requiredLevel = roleLevel[requiredRole];
    if (currentLevel < requiredLevel) {
      return c.json(
        createApiErrorResponse(ApiErrorCode.AUTH_FORBIDDEN, FORBIDDEN_MESSAGE),
        HttpStatus.FORBIDDEN,
      );
    }

    await next();
  };
}

import { ApiErrorCode, createApiErrorResponse } from "@ticket-flow/shared";
import type { Context, Next } from "hono";

import {
  getRoleLevel,
  isValidRole,
  toOrganizationMemberRole,
  type OrganizationMemberRole,
} from "../domain/organization-member.js";
import { HttpStatus } from "../lib/http-status.js";

declare module "hono" {
  interface ContextVariableMap {
    organizationRole?: OrganizationMemberRole;
  }
}

export const FORBIDDEN_MESSAGE = "この操作を行う権限がありません";

export function createRequireRoleMiddleware(
  requiredRole: OrganizationMemberRole,
) {
  // 実行時にも requiredRole が有効なロールであることを検証する
  toOrganizationMemberRole(requiredRole);

  const requiredLevel = getRoleLevel(requiredRole);

  return async function requireRoleMiddleware(
    c: Context,
    next: Next,
  ): Promise<Response | undefined> {
    const currentRole = c.get("organizationRole");
    const currentLevel =
      typeof currentRole === "string" && isValidRole(currentRole)
        ? getRoleLevel(currentRole)
        : undefined;

    if (currentLevel === undefined || currentLevel < requiredLevel) {
      return c.json(
        createApiErrorResponse(ApiErrorCode.AUTH_FORBIDDEN, FORBIDDEN_MESSAGE),
        HttpStatus.FORBIDDEN,
      );
    }

    await next();
  };
}

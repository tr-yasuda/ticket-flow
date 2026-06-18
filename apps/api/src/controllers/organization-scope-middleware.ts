import type { PrismaClient } from "@prisma/client";
import {
  ApiErrorCode,
  createApiErrorResponse,
  type ApiValidationErrorDetail,
} from "@ticket-flow/shared";
import type { Context, Next } from "hono";
import { z } from "zod";

import type { OrganizationMemberRole } from "../domain/organization-member.js";
import { HttpStatus } from "../lib/http-status.js";
import { prisma } from "../lib/prisma.js";

declare module "hono" {
  interface ContextVariableMap {
    organizationId?: string;
    organizationRole?: OrganizationMemberRole;
  }
}

const organizationIdParamSchema = z.string().uuid();

function createInvalidOrganizationIdDetails(): ApiValidationErrorDetail[] {
  return [
    {
      field: "organizationId",
      message: "組織IDの形式が正しくありません",
    },
  ];
}

export function createOrganizationScopeMiddleware(db: PrismaClient = prisma) {
  return async function organizationScopeMiddleware(
    c: Context,
    next: Next,
  ): Promise<Response | undefined> {
    const userId = c.get("userId");
    if (userId === undefined) {
      return c.json(
        createApiErrorResponse(
          ApiErrorCode.AUTH_UNAUTHORIZED,
          "認証が必要です",
        ),
        HttpStatus.UNAUTHORIZED,
      );
    }

    const rawOrganizationId = c.req.param("organizationId");
    const parseResult = organizationIdParamSchema.safeParse(rawOrganizationId);
    if (!parseResult.success) {
      return c.json(
        createApiErrorResponse(
          ApiErrorCode.VALIDATION_ERROR,
          "入力内容を確認してください",
          createInvalidOrganizationIdDetails(),
        ),
        HttpStatus.BAD_REQUEST,
      );
    }

    const organizationId = parseResult.data.toLowerCase();
    const membership = await db.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
      select: { role: true },
    });

    if (membership === null) {
      return c.json(
        createApiErrorResponse(
          ApiErrorCode.AUTH_FORBIDDEN,
          "この組織にアクセスする権限がありません",
        ),
        HttpStatus.FORBIDDEN,
      );
    }

    c.set("organizationId", organizationId);
    c.set("organizationRole", membership.role);
    await next();
  };
}

export const organizationScopeMiddleware = createOrganizationScopeMiddleware();

import {
  ApiErrorCode,
  createApiErrorResponse,
  createApiSuccessResponse,
  type CreateOrganizationInvitationInput,
} from "@ticket-flow/shared";
import type { Context } from "hono";

import { createAuditLog } from "../domain/audit-log.js";
import type { OrganizationMemberRole } from "../domain/organization-member.js";
import { saveAuditLog } from "../infrastructure/database/audit-log-repository.js";
import { HttpStatus } from "../lib/http-status.js";
import { enqueueInvitationEmail } from "../lib/invitation-mail-queue.js";
import { getValidatedJson } from "../lib/validated-json.js";
import {
  createOrganizationInvitation,
  type CreateOrganizationInvitationResult,
} from "../services/organization-invitations-service.js";

type CreateOrganizationInvitationError = Extract<
  CreateOrganizationInvitationResult,
  { success: false }
>["error"];

type InvitationErrorStatus =
  | typeof HttpStatus.BAD_REQUEST
  | typeof HttpStatus.FORBIDDEN
  | typeof HttpStatus.CONFLICT;

type ErrorMapping = Readonly<{
  code: ApiErrorCode;
  status: InvitationErrorStatus;
}>;

function mapInvitationErrorToResponse(
  error: CreateOrganizationInvitationError,
): ErrorMapping {
  switch (error.type) {
    case "already-member":
    case "already-invited":
      return { code: ApiErrorCode.CONFLICT, status: HttpStatus.CONFLICT };
    case "insufficient-role":
      return {
        code: ApiErrorCode.AUTH_FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
      };
    case "invalid-role":
    default:
      return {
        code: ApiErrorCode.VALIDATION_ERROR,
        status: HttpStatus.BAD_REQUEST,
      };
  }
}

export async function createOrganizationInvitationController(c: Context) {
  const organizationId = c.get("organizationId") as string;
  const inviterRole = c.get("organizationRole") as OrganizationMemberRole;
  const inviterUserId = c.get("userId") as string;
  const data = getValidatedJson<CreateOrganizationInvitationInput>(c);

  const result = await createOrganizationInvitation({
    organizationId,
    email: data.email,
    role: data.role,
    inviterRole,
  });

  if (!result.success) {
    const { code, status } = mapInvitationErrorToResponse(result.error);
    return c.json(createApiErrorResponse(code, result.error.message), status);
  }

  enqueueInvitationEmail({
    email: result.data.email,
    organizationId: result.data.organizationId,
    token: result.data.token,
  });

  try {
    const auditLog = createAuditLog({
      organizationId: result.data.organizationId,
      actorId: inviterUserId,
      entityType: "organization_invitation",
      entityId: result.data.id,
      action: "create",
      newValues: {
        email: result.data.email,
        role: result.data.role,
      },
    });
    await saveAuditLog(auditLog);
  } catch (error) {
    // 監査ログの記録失敗は招待作成自体を失敗させない
    console.error("Failed to save audit log for invitation creation", {
      organizationId: result.data.organizationId,
      entityId: result.data.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return c.json(
    createApiSuccessResponse({
      id: result.data.id,
      organizationId: result.data.organizationId,
      email: result.data.email,
      role: result.data.role,
      expiresAt: result.data.expiresAt.toISOString(),
    }),
    HttpStatus.CREATED,
  );
}

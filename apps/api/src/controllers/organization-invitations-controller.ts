import {
  ApiErrorCode,
  createApiErrorResponse,
  createApiSuccessResponse,
  type ApiValidationErrorDetail,
  type CreateOrganizationInvitationInput,
  mapZodErrorToValidationDetails,
  registerInputSchema,
} from "@ticket-flow/shared";
import type { Context } from "hono";

import { createAuditLog } from "../domain/audit-log.js";
import type { OrganizationMemberRole } from "../domain/organization-member.js";
import { verifyAccessToken } from "../domain/token.js";
import { saveAuditLog } from "../infrastructure/database/audit-log-repository.js";
import { extractBearerToken } from "../lib/extract-bearer-token.js";
import { HttpStatus } from "../lib/http-status.js";
import { enqueueInvitationEmail } from "../lib/invitation-mail-queue.js";
import { tokenConfig } from "../lib/token-config.js";
import { getValidatedJson } from "../lib/validated-json.js";
import {
  acceptOrganizationInvitation,
  createOrganizationInvitation,
  type AcceptOrganizationInvitationError,
  type AcceptOrganizationInvitationInput,
  type AcceptOrganizationInvitationResult,
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

type AcceptInvitationErrorStatus =
  | typeof HttpStatus.BAD_REQUEST
  | typeof HttpStatus.UNAUTHORIZED
  | typeof HttpStatus.CONFLICT;

type AcceptInvitationErrorMapping = Readonly<{
  code: ApiErrorCode;
  status: AcceptInvitationErrorStatus;
  details?: ApiValidationErrorDetail[];
}>;

function buildAcceptInvitationValidationDetails(
  error: AcceptOrganizationInvitationError,
): ApiValidationErrorDetail[] {
  const field =
    error.type === "invalid-password"
      ? "password"
      : error.type === "email-mismatch"
        ? "email"
        : "token";
  return [{ field, message: error.message }];
}

function mapAcceptInvitationErrorToResponse(
  error: AcceptOrganizationInvitationError,
): AcceptInvitationErrorMapping {
  switch (error.type) {
    case "already-member":
    case "email-already-exists":
      return { code: ApiErrorCode.CONFLICT, status: HttpStatus.CONFLICT };
    case "unauthenticated-user":
      return {
        code: ApiErrorCode.AUTH_UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      };
    case "invalid-token":
    case "expired-token":
    case "email-mismatch":
    case "invalid-password":
    default:
      return {
        code: ApiErrorCode.VALIDATION_ERROR,
        status: HttpStatus.BAD_REQUEST,
        details: buildAcceptInvitationValidationDetails(error),
      };
  }
}

async function resolveAuthenticatedAcceptInput(
  c: Context,
  token: string,
  authorization: string,
): Promise<AcceptOrganizationInvitationInput | Response> {
  const bearerToken = extractBearerToken(authorization);
  if (bearerToken === null) {
    return c.json(
      createApiErrorResponse(ApiErrorCode.AUTH_UNAUTHORIZED, "認証が必要です"),
      HttpStatus.UNAUTHORIZED,
    );
  }

  try {
    const { userId } = await verifyAccessToken(bearerToken, tokenConfig);
    return { token, authenticatedUserId: userId };
  } catch {
    return c.json(
      createApiErrorResponse(ApiErrorCode.AUTH_UNAUTHORIZED, "認証が必要です"),
      HttpStatus.UNAUTHORIZED,
    );
  }
}

async function resolveRegisteredAcceptInput(
  c: Context,
  token: string,
): Promise<AcceptOrganizationInvitationInput | Response> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      createApiErrorResponse(
        ApiErrorCode.VALIDATION_ERROR,
        "入力内容を確認してください",
      ),
      HttpStatus.BAD_REQUEST,
    );
  }

  const parsed = registerInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      createApiErrorResponse(
        ApiErrorCode.VALIDATION_ERROR,
        "入力内容を確認してください",
        mapZodErrorToValidationDetails(parsed.error.issues),
      ),
      HttpStatus.BAD_REQUEST,
    );
  }

  return {
    token,
    email: parsed.data.email,
    password: parsed.data.password,
  };
}

async function resolveAcceptInvitationInput(
  c: Context,
): Promise<AcceptOrganizationInvitationInput | Response> {
  const token = c.req.param("token");
  if (token === undefined || token.trim() === "") {
    return c.json(
      createApiErrorResponse(
        ApiErrorCode.VALIDATION_ERROR,
        "招待トークンが必要です",
      ),
      HttpStatus.BAD_REQUEST,
    );
  }

  const authorization = c.req.header("Authorization");
  const contentType = c.req.header("Content-Type") ?? "";

  if (authorization !== undefined) {
    if (contentType.includes("application/json")) {
      return c.json(
        createApiErrorResponse(
          ApiErrorCode.VALIDATION_ERROR,
          "認証情報と登録情報を同時に指定できません",
        ),
        HttpStatus.BAD_REQUEST,
      );
    }
    return resolveAuthenticatedAcceptInput(c, token, authorization);
  }

  return resolveRegisteredAcceptInput(c, token);
}

function enqueueAcceptanceAuditLog(
  data: AcceptOrganizationInvitationResult & { success: true },
): void {
  try {
    const auditLog = createAuditLog({
      organizationId: data.data.membership.organizationId,
      actorId: data.data.user.id,
      entityType: "organization_invitation",
      entityId: data.data.invitationId,
      action: "accept",
      newValues: {
        role: data.data.membership.role,
      },
    });
    saveAuditLog(auditLog).catch((error: unknown) => {
      // 監査ログの記録失敗は承諾自体を失敗させない
      console.error("Failed to save audit log for invitation acceptance", {
        organizationId: data.data.membership.organizationId,
        entityId: data.data.invitationId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  } catch (error) {
    console.error("Failed to create audit log for invitation acceptance", {
      organizationId: data.data.membership.organizationId,
      entityId: data.data.invitationId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function acceptOrganizationInvitationController(c: Context) {
  const inputOrResponse = await resolveAcceptInvitationInput(c);
  if (inputOrResponse instanceof Response) {
    return inputOrResponse;
  }

  const result: AcceptOrganizationInvitationResult =
    await acceptOrganizationInvitation(inputOrResponse);

  if (!result.success) {
    const { code, status, details } = mapAcceptInvitationErrorToResponse(
      result.error,
    );
    return c.json(
      createApiErrorResponse(code, result.error.message, details),
      status,
    );
  }

  enqueueAcceptanceAuditLog(result);

  return c.json(createApiSuccessResponse(result.data), HttpStatus.CREATED);
}

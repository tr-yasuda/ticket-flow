import {
  ApiErrorCode,
  createApiErrorResponse,
  createApiSuccessResponse,
  type UpdateOrganizationMemberRoleInput,
} from "@ticket-flow/shared";
import type { Context } from "hono";

import { HttpStatus } from "../lib/http-status.js";
import { getValidatedJson } from "../lib/validated-json.js";
import {
  deleteOrganizationMember,
  updateOrganizationMemberRole,
  type DeleteOrganizationMemberResult,
  type UpdateOrganizationMemberRoleResult,
} from "../services/organization-members-service.js";
import {
  type DeleteOrganizationMemberParams,
  type UpdateOrganizationMemberRoleParams,
} from "./schemas/organization-member-schema.js";

type UpdateOrganizationMemberRoleError = Extract<
  UpdateOrganizationMemberRoleResult,
  { success: false }
>["error"];

type UpdateRoleErrorStatus =
  | typeof HttpStatus.BAD_REQUEST
  | typeof HttpStatus.NOT_FOUND;

type ErrorMapping = Readonly<{
  code: ApiErrorCode;
  status: UpdateRoleErrorStatus;
}>;

function mapUpdateRoleErrorToResponse(
  error: UpdateOrganizationMemberRoleError,
): ErrorMapping {
  switch (error.type) {
    case "target-not-found":
      return { code: ApiErrorCode.NOT_FOUND, status: HttpStatus.NOT_FOUND };
    case "last-owner":
    case "same-role":
      return {
        code: ApiErrorCode.VALIDATION_ERROR,
        status: HttpStatus.BAD_REQUEST,
      };
  }
}

export async function updateOrganizationMemberRoleController(c: Context) {
  const organizationId = c.get("organizationId") as string;
  const actorUserId = c.get("userId") as string;
  const { userId: targetUserId } = c.req.valid(
    "param" as never,
  ) as UpdateOrganizationMemberRoleParams;
  const { role: newRole } =
    getValidatedJson<UpdateOrganizationMemberRoleInput>(c);

  const result = await updateOrganizationMemberRole({
    organizationId,
    targetUserId,
    newRole,
    actorUserId,
  });

  if (!result.success) {
    const { code, status } = mapUpdateRoleErrorToResponse(result.error);
    return c.json(createApiErrorResponse(code, result.error.message), status);
  }

  return c.json(
    createApiSuccessResponse({
      id: result.data.member.id,
      userId: result.data.member.userId,
      role: result.data.member.role,
    }),
    HttpStatus.OK,
  );
}

type DeleteOrganizationMemberError = Extract<
  DeleteOrganizationMemberResult,
  { success: false }
>["error"];

type DeleteOrganizationMemberErrorStatus =
  | typeof HttpStatus.BAD_REQUEST
  | typeof HttpStatus.FORBIDDEN
  | typeof HttpStatus.NOT_FOUND;

type DeleteOrganizationMemberErrorMapping = Readonly<{
  code: ApiErrorCode;
  status: DeleteOrganizationMemberErrorStatus;
}>;

function mapDeleteOrganizationMemberErrorToResponse(
  error: DeleteOrganizationMemberError,
): DeleteOrganizationMemberErrorMapping {
  switch (error.type) {
    case "target-not-found":
      return { code: ApiErrorCode.NOT_FOUND, status: HttpStatus.NOT_FOUND };
    case "insufficient-role":
      return {
        code: ApiErrorCode.AUTH_FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
      };
    case "last-owner":
      return {
        code: ApiErrorCode.VALIDATION_ERROR,
        status: HttpStatus.BAD_REQUEST,
      };
  }
}

export async function deleteOrganizationMemberController(c: Context) {
  const organizationId = c.get("organizationId") as string;
  const actorUserId = c.get("userId") as string;
  const { userId: targetUserId } = c.req.valid(
    "param" as never,
  ) as DeleteOrganizationMemberParams;

  const result = await deleteOrganizationMember({
    organizationId,
    targetUserId,
    actorUserId,
  });

  if (!result.success) {
    const { code, status } = mapDeleteOrganizationMemberErrorToResponse(
      result.error,
    );
    return c.json(createApiErrorResponse(code, result.error.message), status);
  }

  return c.json(
    createApiSuccessResponse({
      id: result.data.member.id,
      userId: result.data.member.userId,
      role: result.data.member.role,
    }),
    HttpStatus.OK,
  );
}

import {
  ApiErrorCode,
  createApiErrorResponse,
  createApiPaginatedSuccessResponse,
  createApiSuccessResponse,
  type CreateOrganizationInput,
} from "@ticket-flow/shared";
import type { Context } from "hono";

import type { OrganizationMemberRole } from "../domain/organization-member.js";
import { HttpStatus } from "../lib/http-status.js";
import {
  type JsonInput,
  type QueryInput,
  type ValidatedContext,
} from "../lib/validated-input.js";
import {
  createOrganization,
  getOrganizationMembers,
  getOrganizationsByUserId,
} from "../services/organizations-service.js";

type CreateOrganizationControllerContext = ValidatedContext<
  JsonInput<CreateOrganizationInput>
>;

type ListOrganizationMembersControllerContext = ValidatedContext<
  QueryInput<{ page: number; perPage: number }>
>;

export async function createOrganizationController(
  c: CreateOrganizationControllerContext,
) {
  const userId = c.get("userId");
  if (userId === undefined) {
    return c.json(
      createApiErrorResponse(ApiErrorCode.AUTH_UNAUTHORIZED, "認証が必要です"),
      HttpStatus.UNAUTHORIZED,
    );
  }

  const data = c.req.valid("json");
  const result = await createOrganization({
    name: data.name,
    slug: data.slug,
    ownerUserId: userId,
  });

  if (!result.success) {
    const isSlugConflict = result.error.type === "slug-already-exists";
    const isOwnerNotFound = result.error.type === "owner-not-found";
    return c.json(
      createApiErrorResponse(
        isSlugConflict
          ? ApiErrorCode.CONFLICT
          : isOwnerNotFound
            ? ApiErrorCode.AUTH_UNAUTHORIZED
            : ApiErrorCode.VALIDATION_ERROR,
        result.error.message,
      ),
      isSlugConflict
        ? HttpStatus.CONFLICT
        : isOwnerNotFound
          ? HttpStatus.UNAUTHORIZED
          : HttpStatus.BAD_REQUEST,
    );
  }

  return c.json(createApiSuccessResponse(result.data), HttpStatus.CREATED);
}

export async function getOrganizationsController(c: Context) {
  // authMiddleware guarantees userId is set for /api/organizations/*
  const userId = c.get("userId") as string;

  const result = await getOrganizationsByUserId({ userId });
  if (!result.success) {
    return c.json(
      createApiErrorResponse(
        ApiErrorCode.AUTH_UNAUTHORIZED,
        result.error.message,
      ),
      HttpStatus.UNAUTHORIZED,
    );
  }

  return c.json(createApiSuccessResponse(result.data), HttpStatus.OK);
}

export async function getOrganizationController(c: Context) {
  const organizationId = c.get("organizationId") as string;
  const organizationRole = c.get("organizationRole") as OrganizationMemberRole;

  return c.json(
    createApiSuccessResponse({ organizationId, organizationRole }),
    HttpStatus.OK,
  );
}

export async function getOrganizationMembersController(
  c: ListOrganizationMembersControllerContext,
) {
  const organizationId = c.get("organizationId") as string;
  const { page, perPage } = c.req.valid("query");

  const result = await getOrganizationMembers({
    organizationId,
    page,
    perPage,
  });

  const totalPages = Math.ceil(result.data.total / perPage);

  return c.json(
    createApiPaginatedSuccessResponse(
      { members: result.data.members },
      {
        page,
        perPage,
        total: result.data.total,
        totalPages,
      },
    ),
    HttpStatus.OK,
  );
}

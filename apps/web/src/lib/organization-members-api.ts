import {
  organizationMembersListResponseSchema,
  type OrganizationMemberListItemResponse,
} from "@ticket-flow/shared";

import { apiClient } from "./api-client";
import { extractPaginatedResponse } from "./api-response";
import {
  DEFAULT_PER_PAGE,
  MIN_PAGE,
  normalizePage,
  normalizePerPage,
} from "./pagination";

export type OrganizationMemberListItem = OrganizationMemberListItemResponse;

export type ListOrganizationMembersInput = Readonly<{
  organizationId: string;
  page?: number;
  perPage?: number;
  signal?: AbortSignal;
}>;

export type ListOrganizationMembersResult = Readonly<{
  members: readonly OrganizationMemberListItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}>;

function isUnsafePathSegment(value: string): boolean {
  return value === "." || value === "..";
}

function buildOrganizationMembersPath(organizationId: string): string {
  const trimmed = organizationId.trim();
  if (trimmed.length === 0) {
    throw new Error("organizationId must not be empty");
  }
  if (isUnsafePathSegment(trimmed)) {
    throw new Error("organizationId must not be a relative path segment");
  }
  return `organizations/${encodeURIComponent(trimmed)}/members`;
}

export async function getOrganizationMembers(
  input: ListOrganizationMembersInput,
): Promise<ListOrganizationMembersResult> {
  const {
    organizationId,
    page = MIN_PAGE,
    perPage = DEFAULT_PER_PAGE,
    signal,
  } = input;

  const normalizedPage = normalizePage(page);
  const normalizedPerPage = normalizePerPage(perPage);

  const body = await apiClient
    .get(buildOrganizationMembersPath(organizationId), {
      searchParams: {
        page: String(normalizedPage),
        perPage: String(normalizedPerPage),
      },
      signal,
    })
    .json<unknown>();

  const { data, meta } = extractPaginatedResponse(
    body,
    organizationMembersListResponseSchema,
    "Invalid organization members response",
  );

  return {
    members: data.members,
    page: meta.page,
    perPage: meta.perPage,
    total: meta.total,
    totalPages: meta.totalPages,
  };
}

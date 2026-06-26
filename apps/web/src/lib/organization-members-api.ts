import { organizationMemberRoleSchema } from "@ticket-flow/shared";
import type { z } from "zod";

import { apiClient } from "./api-client";
import { extractData, isRecord } from "./api-response";

export type OrganizationMemberRole = z.infer<
  typeof organizationMemberRoleSchema
>;

export type OrganizationMember = Readonly<{
  id: string;
  userId: string;
  name: string | null;
  email: string;
  role: OrganizationMemberRole;
  joinedAt: string;
}>;

function isOrganizationMemberRole(
  value: unknown,
): value is OrganizationMemberRole {
  return (
    typeof value === "string" &&
    organizationMemberRoleSchema.options.includes(
      value as OrganizationMemberRole,
    )
  );
}

function isOrganizationMember(value: unknown): value is OrganizationMember {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.userId === "string" &&
    (value.name === null || typeof value.name === "string") &&
    typeof value.email === "string" &&
    isOrganizationMemberRole(value.role) &&
    typeof value.joinedAt === "string"
  );
}

function isOrganizationMembersData(
  data: unknown,
): data is { members: readonly OrganizationMember[] } {
  return (
    isRecord(data) &&
    Array.isArray(data.members) &&
    data.members.every(isOrganizationMember)
  );
}

const DEFAULT_MEMBERS_PER_PAGE = 100;

export async function getOrganizationMembers(
  organizationId: string,
): Promise<{ members: readonly OrganizationMember[] }> {
  const body = await apiClient
    .get(`organizations/${encodeURIComponent(organizationId)}/members`, {
      searchParams: { page: 1, perPage: DEFAULT_MEMBERS_PER_PAGE },
    })
    .json<unknown>();
  return extractData(body, isOrganizationMembersData);
}

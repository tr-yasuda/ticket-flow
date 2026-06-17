import { randomUUID } from "node:crypto";

export type OrganizationMemberId = string;
export type OrganizationId = string;
export type UserId = string;
export type OrganizationMemberRole = "owner" | "member";

export type OrganizationMember = Readonly<{
  id: OrganizationMemberId;
  organizationId: OrganizationId;
  userId: UserId;
  role: OrganizationMemberRole;
}>;

function isNonEmptyString(value: string): boolean {
  return value.trim().length > 0;
}

function isValidRole(role: string): role is OrganizationMemberRole {
  return role === "owner" || role === "member";
}

function validateOrganizationMember(
  id: OrganizationMemberId,
  organizationId: OrganizationId,
  userId: UserId,
  role: OrganizationMemberRole,
): OrganizationMember {
  if (!isNonEmptyString(id)) {
    throw new Error("id is required");
  }

  if (!isNonEmptyString(organizationId)) {
    throw new Error("organizationId is required");
  }

  if (!isNonEmptyString(userId)) {
    throw new Error("userId is required");
  }

  if (!isValidRole(role)) {
    throw new Error("role must be owner or member");
  }

  return {
    id,
    organizationId,
    userId,
    role,
  };
}

export function createOrganizationMember(
  organizationId: OrganizationId,
  userId: UserId,
  role: OrganizationMemberRole,
): OrganizationMember {
  return validateOrganizationMember(randomUUID(), organizationId, userId, role);
}

export function rehydrateOrganizationMember(
  id: OrganizationMemberId,
  organizationId: OrganizationId,
  userId: UserId,
  role: OrganizationMemberRole,
): OrganizationMember {
  return validateOrganizationMember(id, organizationId, userId, role);
}

import { randomUUID } from "node:crypto";

import { organizationMemberRoles } from "@ticket-flow/shared";

export type OrganizationMemberId = string;
export type OrganizationId = string;
export type UserId = string;

export type OrganizationMemberRole = (typeof organizationMemberRoles)[number];

export type OrganizationMember = Readonly<{
  id: OrganizationMemberId;
  organizationId: OrganizationId;
  userId: UserId;
  role: OrganizationMemberRole;
}>;

function isNonEmptyString(value: string): boolean {
  return value.trim().length > 0;
}

export function isValidRole(role: string): role is OrganizationMemberRole {
  return organizationMemberRoles.some((validRole) => validRole === role);
}

export const roleHierarchy: readonly OrganizationMemberRole[] = [
  "viewer",
  "member",
  "admin",
  "owner",
];

export function getRoleLevel(role: OrganizationMemberRole): number {
  const level = roleHierarchy.indexOf(role);
  if (level === -1) {
    throw new Error(
      `role must be one of ${organizationMemberRoles.join(", ")}`,
    );
  }
  return level;
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
    throw new Error(
      `role must be one of ${organizationMemberRoles.join(", ")}`,
    );
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

/**
 * メンバーのロールを変更する。
 *
 * この関数は純粋なロール更新を行うのみで、呼び出し元で操作者の権限を検証すること。
 * 最後の owner 不在防止などの不変条件は service 層で検証する。
 */
export function changeRole(
  member: OrganizationMember,
  role: OrganizationMemberRole,
): OrganizationMember {
  return rehydrateOrganizationMember(
    member.id,
    member.organizationId,
    member.userId,
    role,
  );
}

export function toOrganizationMemberRole(role: string): OrganizationMemberRole {
  if (!isValidRole(role)) {
    throw new Error(
      `role must be one of ${organizationMemberRoles.join(", ")}`,
    );
  }
  return role;
}

export class UserNotOrganizationMemberError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserNotOrganizationMemberError";
  }
}

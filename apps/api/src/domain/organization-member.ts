import { randomUUID } from "node:crypto";

export type OrganizationMemberId = string;
export type OrganizationId = string;
export type UserId = string;

export const organizationMemberRoles = [
  "owner",
  "admin",
  "member",
  "viewer",
] as const;

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

function isValidRole(role: string): role is OrganizationMemberRole {
  return organizationMemberRoles.some((validRole) => validRole === role);
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
 * この関数は純粋なロール更新を行うのみで、呼び出し元（ユースケース層）で
 * 操作者の権限・最後の owner 不在防止などの認可・不変条件を検証すること。
 * TODO: 認可ルールは #21 等で実装予定。
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

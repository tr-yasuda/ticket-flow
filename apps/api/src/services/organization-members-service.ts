import { type PrismaClient } from "@prisma/client";

import { createAuditLog } from "../domain/audit-log.js";
import {
  changeRole,
  type OrganizationMember,
  type OrganizationMemberRole,
} from "../domain/organization-member.js";
import { saveAuditLog } from "../infrastructure/database/audit-log-repository.js";
import { prisma } from "../lib/prisma.js";

export class LastOwnerChangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LastOwnerChangeError";
  }
}

export type UpdateOrganizationMemberRoleServiceInput = Readonly<{
  organizationId: string;
  targetUserId: string;
  newRole: OrganizationMemberRole;
  actorUserId: string;
}>;

export type UpdateOrganizationMemberRoleResult =
  | {
      success: true;
      data: { member: OrganizationMember; oldRole: OrganizationMemberRole };
    }
  | {
      success: false;
      error:
        | { type: "target-not-found"; message: string }
        | { type: "same-role"; message: string }
        | { type: "last-owner"; message: string };
    };

export async function updateOrganizationMemberRole(
  input: UpdateOrganizationMemberRoleServiceInput,
  db: PrismaClient = prisma,
): Promise<UpdateOrganizationMemberRoleResult> {
  try {
    return await db.$transaction(async (tx) => {
      const membership = await tx.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: input.organizationId,
            userId: input.targetUserId,
          },
        },
      });

      if (membership === null) {
        return {
          success: false,
          error: {
            type: "target-not-found",
            message: "指定されたメンバーが組織に所属していません",
          },
        };
      }

      const oldRole = membership.role as OrganizationMemberRole;
      if (oldRole === input.newRole) {
        return {
          success: false,
          error: {
            type: "same-role",
            message: "現在のロールと同じロールを指定しています",
          },
        };
      }

      if (oldRole === "owner" && input.newRole !== "owner") {
        const ownerCount = await tx.organizationMember.count({
          where: {
            organizationId: input.organizationId,
            role: "owner",
          },
        });

        if (ownerCount <= 1) {
          throw new LastOwnerChangeError(
            "最後の Owner のロールは変更できません",
          );
        }
      }

      const updated = await tx.organizationMember.update({
        where: { id: membership.id },
        data: { role: input.newRole },
      });

      const updatedMember = changeRole(
        {
          id: updated.id,
          organizationId: updated.organizationId,
          userId: updated.userId,
          role: oldRole,
        },
        input.newRole,
      );

      const auditLog = createAuditLog({
        organizationId: input.organizationId,
        actorId: input.actorUserId,
        entityType: "organization_member",
        entityId: updatedMember.id,
        action: "role_changed",
        oldValues: { role: oldRole },
        newValues: { role: updatedMember.role },
      });
      await saveAuditLog(auditLog, tx);

      return {
        success: true,
        data: {
          member: updatedMember,
          oldRole,
        },
      };
    });
  } catch (error) {
    if (error instanceof LastOwnerChangeError) {
      return {
        success: false,
        error: { type: "last-owner", message: error.message },
      };
    }
    throw error;
  }
}

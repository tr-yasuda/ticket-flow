import { Prisma, type PrismaClient } from "@prisma/client";

import {
  createOrganizationInvitation as createOrganizationInvitationEntity,
  generateInvitationToken,
  hashInvitationToken,
  InvalidInvitationRoleError,
  normalizeInvitationEmail,
} from "../domain/organization-invitation.js";
import type { OrganizationMemberRole } from "../domain/organization-member.js";
import { isUniqueConstraintTarget } from "../lib/prisma-error.js";
import { prisma } from "../lib/prisma.js";

export type CreateOrganizationInvitationInput = Readonly<{
  organizationId: string;
  email: string;
  role: OrganizationMemberRole;
  inviterRole: OrganizationMemberRole;
}>;

export type CreateOrganizationInvitationSuccess = Readonly<{
  id: string;
  organizationId: string;
  email: string;
  role: OrganizationMemberRole;
  token: string;
  expiresAt: Date;
}>;

export type CreateOrganizationInvitationResult =
  | { success: true; data: CreateOrganizationInvitationSuccess }
  | {
      success: false;
      error:
        | { type: "already-member"; message: string }
        | { type: "already-invited"; message: string }
        | { type: "invalid-role"; message: string }
        | { type: "insufficient-role"; message: string };
    };

const MAX_TOKEN_HASH_ATTEMPTS = 5;

function canInviteRole(
  inviterRole: OrganizationMemberRole,
  targetRole: OrganizationMemberRole,
): boolean {
  if (targetRole === "admin") {
    return inviterRole === "owner";
  }
  return true;
}

async function resolveUniqueTokenHash(): Promise<{
  token: string;
  tokenHash: string;
}> {
  const token = generateInvitationToken();
  return {
    token,
    tokenHash: hashInvitationToken(token),
  };
}

function isOrganizationEmailConflict(
  error: Prisma.PrismaClientKnownRequestError,
): boolean {
  return (
    isUniqueConstraintTarget(error, "organization_id") ||
    isUniqueConstraintTarget(error, "email")
  );
}

export async function createOrganizationInvitation(
  input: CreateOrganizationInvitationInput,
  db: PrismaClient = prisma,
): Promise<CreateOrganizationInvitationResult> {
  if (!canInviteRole(input.inviterRole, input.role)) {
    return {
      success: false,
      error: {
        type: "insufficient-role",
        message: "admin を招待できるのは owner だけです",
      },
    };
  }

  let invitationResult;
  try {
    invitationResult = createOrganizationInvitationEntity(
      input.organizationId,
      normalizeInvitationEmail(input.email),
      input.role,
    );
  } catch (error) {
    if (error instanceof InvalidInvitationRoleError) {
      return {
        success: false,
        error: {
          type: "invalid-role",
          message: error.message,
        },
      };
    }
    throw error;
  }

  const { invitation } = invitationResult;
  let token = invitationResult.token;
  let tokenHash = invitation.tokenHash;

  let transactionResult;
  try {
    transactionResult = await db.$transaction(async (tx) => {
      const existingMember = await tx.organizationMember.findFirst({
        where: {
          organizationId: invitation.organizationId,
          user: { email: invitation.email },
        },
        select: { id: true },
      });
      if (existingMember !== null) {
        return { type: "already-member" } as const;
      }

      const existingInvitation = await tx.organizationInvitation.findUnique({
        where: {
          organizationId_email: {
            organizationId: invitation.organizationId,
            email: invitation.email,
          },
        },
      });

      if (
        existingInvitation !== null &&
        existingInvitation.expiresAt > new Date()
      ) {
        return { type: "already-invited" } as const;
      }

      for (let attempt = 1; attempt <= MAX_TOKEN_HASH_ATTEMPTS; attempt++) {
        const existingByToken = await tx.organizationInvitation.findUnique({
          where: { tokenHash },
          select: { id: true },
        });
        if (existingByToken === null) {
          break;
        }
        const regenerated = await resolveUniqueTokenHash();
        token = regenerated.token;
        tokenHash = regenerated.tokenHash;
      }

      const finalExistingByToken = await tx.organizationInvitation.findUnique({
        where: { tokenHash },
        select: { id: true },
      });
      if (finalExistingByToken !== null) {
        throw new Error("招待トークンの一意なハッシュを生成できませんでした");
      }

      if (existingInvitation !== null) {
        await tx.organizationInvitation.update({
          where: {
            organizationId_email: {
              organizationId: invitation.organizationId,
              email: invitation.email,
            },
          },
          data: {
            role: invitation.role,
            tokenHash,
            createdAt: new Date(),
            expiresAt: invitation.expiresAt,
          },
        });
        return { type: "updated", id: existingInvitation.id } as const;
      }

      await tx.organizationInvitation.create({
        data: {
          id: invitation.id,
          organizationId: invitation.organizationId,
          email: invitation.email,
          role: invitation.role,
          tokenHash,
          expiresAt: invitation.expiresAt,
        },
      });

      return { type: "created", id: invitation.id } as const;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      isOrganizationEmailConflict(error)
    ) {
      return {
        success: false,
        error: {
          type: "already-invited",
          message:
            "指定されたメールアドレスには既に有効な招待が送信されています",
        },
      };
    }
    throw error;
  }

  if (transactionResult.type === "already-member") {
    return {
      success: false,
      error: {
        type: "already-member",
        message: "指定されたメールアドレスのユーザーは既に組織のメンバーです",
      },
    };
  }

  if (transactionResult.type === "already-invited") {
    return {
      success: false,
      error: {
        type: "already-invited",
        message: "指定されたメールアドレスには既に有効な招待が送信されています",
      },
    };
  }

  return {
    success: true,
    data: {
      id: transactionResult.id,
      organizationId: invitation.organizationId,
      email: invitation.email,
      role: invitation.role,
      token,
      expiresAt: invitation.expiresAt,
    },
  };
}

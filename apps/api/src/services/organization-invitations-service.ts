import { type PrismaClient } from "@prisma/client";

import {
  createOrganizationInvitation as createOrganizationInvitationEntity,
  generateInvitationToken,
  hashInvitationToken,
  InvalidInvitationRoleError,
  normalizeInvitationEmail,
} from "../domain/organization-invitation.js";
import type { OrganizationMemberRole } from "../domain/organization-member.js";
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

  const { invitation, token } = invitationResult;

  const transactionResult = await db.$transaction(async (tx) => {
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

    const now = new Date();
    const existingActiveInvitation = await tx.organizationInvitation.findFirst({
      where: {
        organizationId: invitation.organizationId,
        email: invitation.email,
        expiresAt: { gt: now },
      },
      select: { id: true },
    });
    if (existingActiveInvitation !== null) {
      return { type: "already-invited" } as const;
    }

    let tokenHash = invitation.tokenHash;
    for (let attempt = 1; attempt <= MAX_TOKEN_HASH_ATTEMPTS; attempt++) {
      const existingByToken = await tx.organizationInvitation.findUnique({
        where: { tokenHash },
        select: { id: true },
      });
      if (existingByToken === null) {
        break;
      }
      tokenHash = hashInvitationToken(generateInvitationToken());
      if (attempt === MAX_TOKEN_HASH_ATTEMPTS) {
        // 最後の attempt でも重複していれば、DB の unique 制約で検知させる
        break;
      }
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

    return { type: "created" } as const;
  });

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
      id: invitation.id,
      organizationId: invitation.organizationId,
      email: invitation.email,
      role: invitation.role,
      token,
      expiresAt: invitation.expiresAt,
    },
  };
}

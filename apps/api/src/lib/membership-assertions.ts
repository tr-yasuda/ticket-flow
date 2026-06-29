import { type Prisma, type PrismaClient } from "@prisma/client";

import { UserNotOrganizationMemberError } from "../domain/organization-member.js";

export async function isUserOrganizationMember(
  db: PrismaClient | Prisma.TransactionClient,
  organizationId: string,
  userId: string,
): Promise<boolean> {
  const membership = await db.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
  });

  return membership !== null;
}

export async function assertUserIsOrganizationMember(
  db: PrismaClient | Prisma.TransactionClient,
  organizationId: string,
  userId: string,
): Promise<void> {
  const isMember = await isUserOrganizationMember(db, organizationId, userId);

  if (!isMember) {
    throw new UserNotOrganizationMemberError(
      `ユーザー ${userId} は組織 ${organizationId} のメンバーではありません`,
    );
  }
}

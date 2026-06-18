import { Prisma, type PrismaClient } from "@prisma/client";

import { createOrganizationMember } from "../domain/organization-member.js";
import { createOrganization as createOrganizationEntity } from "../domain/organization.js";
import { isUniqueConstraintTarget } from "../lib/prisma-error.js";
import { prisma } from "../lib/prisma.js";

export type CreateOrganizationInput = Readonly<{
  name: string;
  slug: string;
  ownerUserId: string;
}>;

export type CreateOrganizationResult =
  | { success: true; data: { id: string; name: string; slug: string } }
  | {
      success: false;
      error:
        | { type: "slug-already-exists"; message: string }
        | { type: "owner-not-found"; message: string };
    };

export async function createOrganization(
  input: CreateOrganizationInput,
  db: PrismaClient = prisma,
): Promise<CreateOrganizationResult> {
  const owner = await db.user.findUnique({
    where: { id: input.ownerUserId },
  });
  if (owner === null) {
    return {
      success: false,
      error: {
        type: "owner-not-found",
        message: "Owner user not found",
      },
    };
  }

  const organization = createOrganizationEntity(input.name, input.slug);
  const ownerMember = createOrganizationMember(
    organization.id,
    input.ownerUserId,
    "owner",
  );

  try {
    await db.$transaction(async (tx) => {
      await tx.organization.create({
        data: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
        },
      });
      await tx.organizationMember.create({
        data: {
          id: ownerMember.id,
          organizationId: ownerMember.organizationId,
          userId: ownerMember.userId,
          role: ownerMember.role,
        },
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      isUniqueConstraintTarget(error, "slug")
    ) {
      return {
        success: false,
        error: {
          type: "slug-already-exists",
          message: "Slug already exists",
        },
      };
    }
    throw error;
  }

  return {
    success: true,
    data: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    },
  };
}

import { Prisma, type PrismaClient } from "@prisma/client";

import {
  createOrganizationMember,
  type OrganizationMemberRole,
} from "../domain/organization-member.js";
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

export type GetOrganizationsByUserIdInput = Readonly<{
  userId: string;
}>;

export type OrganizationWithRole = Readonly<{
  id: string;
  name: string;
  slug: string;
  role: OrganizationMemberRole;
}>;

export type GetOrganizationsByUserIdSuccess = Readonly<{
  organizations: readonly OrganizationWithRole[];
}>;

export type GetOrganizationsByUserIdResult =
  | { success: true; data: GetOrganizationsByUserIdSuccess }
  | {
      success: false;
      error: { type: "user-not-found"; message: string };
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

export async function getOrganizationsByUserId(
  input: GetOrganizationsByUserIdInput,
  db: PrismaClient = prisma,
): Promise<GetOrganizationsByUserIdResult> {
  const memberships = await db.organizationMember.findMany({
    where: { userId: input.userId },
    select: {
      role: true,
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
    orderBy: [
      {
        organization: {
          name: "asc",
        },
      },
      {
        organization: {
          id: "asc",
        },
      },
    ],
  });

  return {
    success: true,
    data: {
      organizations: memberships.map((membership) => ({
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
        role: membership.role as OrganizationMemberRole,
      })),
    },
  };
}

export type OrganizationMemberListItem = Readonly<{
  id: string;
  userId: string;
  name: string | null;
  email: string;
  role: OrganizationMemberRole;
  joinedAt: string;
}>;

export type GetOrganizationMembersInput = Readonly<{
  organizationId: string;
  page: number;
  perPage: number;
}>;

export type GetOrganizationMembersSuccess = Readonly<{
  members: readonly OrganizationMemberListItem[];
  total: number;
}>;

export type GetOrganizationMembersResult = Readonly<{
  success: true;
  data: GetOrganizationMembersSuccess;
}>;

export async function getOrganizationMembers(
  input: GetOrganizationMembersInput,
  db: PrismaClient = prisma,
): Promise<GetOrganizationMembersResult> {
  const skip = (input.page - 1) * input.perPage;

  const [memberships, total] = await Promise.all([
    db.organizationMember.findMany({
      where: {
        organizationId: input.organizationId,
      },
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip,
      take: input.perPage,
    }),
    db.organizationMember.count({
      where: {
        organizationId: input.organizationId,
      },
    }),
  ]);

  return {
    success: true,
    data: {
      members: memberships.map((membership) => ({
        id: membership.id,
        userId: membership.user.id,
        // User モデルに name カラムがないため、現時点では null を返す
        name: null,
        email: membership.user.email,
        role: membership.role,
        joinedAt: membership.createdAt.toISOString(),
      })),
      total,
    },
  };
}

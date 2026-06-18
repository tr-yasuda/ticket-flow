import { PrismaClient, Prisma } from "@prisma/client";

import type {
  OrganizationMemberRepository,
  OrganizationMemberWithOrganization,
} from "../../domain/organization-member-repository.js";
import {
  organizationMemberRoles,
  rehydrateOrganizationMember,
  type OrganizationMember,
  type OrganizationMemberId,
  type OrganizationMemberRole,
} from "../../domain/organization-member.js";
import { DuplicateOrganizationMembershipError } from "../../domain/repository-error.js";

export class PrismaOrganizationMemberRepository implements OrganizationMemberRepository {
  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
  ) {}

  async findById(id: OrganizationMemberId): Promise<OrganizationMember | null> {
    const record = await this.prisma.organizationMember.findUnique({
      where: { id },
    });
    return record ? this.toOrganizationMember(record) : null;
  }

  async findByOrganizationIdAndUserId(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMember | null> {
    const record = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });
    return record ? this.toOrganizationMember(record) : null;
  }

  async findByUserId(
    userId: string,
  ): Promise<readonly OrganizationMemberWithOrganization[]> {
    const records = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: { organization: true },
      orderBy: { organization: { name: "asc" } },
    });
    return records.map((record) => ({
      membershipId: record.id,
      organizationId: record.organizationId,
      userId: record.userId,
      role: toOrganizationMemberRole(record.role),
      organizationName: record.organization.name,
      organizationSlug: record.organization.slug,
    }));
  }

  async findAll(): Promise<readonly OrganizationMember[]> {
    const records = await this.prisma.organizationMember.findMany({
      orderBy: { createdAt: "asc" },
    });
    return records.map((record) => this.toOrganizationMember(record));
  }

  async save(entity: OrganizationMember): Promise<void> {
    try {
      await this.prisma.organizationMember.upsert({
        where: {
          organizationId_userId: {
            organizationId: entity.organizationId,
            userId: entity.userId,
          },
        },
        create: {
          id: entity.id,
          organizationId: entity.organizationId,
          userId: entity.userId,
          role: entity.role,
        },
        update: {
          role: entity.role,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        isOrganizationMemberUniqueViolation(error)
      ) {
        throw new DuplicateOrganizationMembershipError();
      }
      throw error;
    }
  }

  async delete(id: OrganizationMemberId): Promise<void> {
    try {
      await this.prisma.organizationMember.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return;
      }
      throw error;
    }
  }

  private toOrganizationMember(record: {
    id: string;
    organizationId: string;
    userId: string;
    role: string;
  }): OrganizationMember {
    return rehydrateOrganizationMember(
      record.id,
      record.organizationId,
      record.userId,
      toOrganizationMemberRole(record.role),
    );
  }

  withTransaction(tx: unknown): OrganizationMemberRepository {
    return new PrismaOrganizationMemberRepository(
      tx as Prisma.TransactionClient,
    );
  }
}

function isOrganizationMemberUniqueViolation(
  error: Prisma.PrismaClientKnownRequestError,
): boolean {
  const target = error.meta?.target;
  if (typeof target === "string") {
    return target.includes("organization_id") && target.includes("user_id");
  }
  if (Array.isArray(target)) {
    return target.includes("organization_id") && target.includes("user_id");
  }
  return false;
}

function toOrganizationMemberRole(role: string): OrganizationMemberRole {
  const matched = organizationMemberRoles.find(
    (validRole) => validRole === role,
  );
  if (matched !== undefined) {
    return matched;
  }
  throw new Error(`Invalid organization member role: ${role}`);
}

import { PrismaClient, Prisma } from "@prisma/client";

import type { OrganizationRepository } from "../../domain/organization-repository.js";
import type {
  Organization,
  OrganizationId,
} from "../../domain/organization.js";
import { rehydrateOrganization } from "../../domain/organization.js";
import { DuplicateSlugError } from "../../domain/repository-error.js";

export class PrismaOrganizationRepository implements OrganizationRepository {
  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
  ) {}

  async findById(id: OrganizationId): Promise<Organization | null> {
    const record = await this.prisma.organization.findUnique({ where: { id } });
    return record ? this.toOrganization(record) : null;
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    const record = await this.prisma.organization.findUnique({
      where: { slug: slug.trim().toLowerCase() },
    });
    return record ? this.toOrganization(record) : null;
  }

  async findByName(name: string): Promise<readonly Organization[]> {
    const query = escapeLikePattern(name.trim().toLowerCase());
    // SQLite 上で大文字小文字を区別せず部分一致検索する
    const records = await this.prisma.$queryRaw<
      Array<{ id: string; name: string; slug: string }>
    >`
      SELECT id, name, slug
      FROM "organizations"
      WHERE LOWER(name) LIKE '%' || ${query} || '%' ESCAPE '\\'
      ORDER BY created_at ASC
    `;
    return records.map((record) => this.toOrganization(record));
  }

  async findAll(): Promise<readonly Organization[]> {
    const records = await this.prisma.organization.findMany({
      orderBy: { createdAt: "asc" },
    });
    return records.map((record) => this.toOrganization(record));
  }

  async save(entity: Organization): Promise<void> {
    try {
      await this.prisma.organization.upsert({
        where: { id: entity.id },
        create: {
          id: entity.id,
          name: entity.name,
          slug: entity.slug,
        },
        update: {
          name: entity.name,
          slug: entity.slug,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new DuplicateSlugError();
      }
      throw error;
    }
  }

  async delete(id: OrganizationId): Promise<void> {
    try {
      await this.prisma.organization.delete({ where: { id } });
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

  private toOrganization(record: {
    id: string;
    name: string;
    slug: string;
  }): Organization {
    return rehydrateOrganization(record.id, record.name, record.slug);
  }

  withTransaction(tx: unknown): OrganizationRepository {
    return new PrismaOrganizationRepository(tx as Prisma.TransactionClient);
  }
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

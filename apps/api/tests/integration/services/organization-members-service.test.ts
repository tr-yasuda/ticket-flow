import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../../../src/lib/prisma.js";
import { registerUser } from "../../../src/services/auth-service.js";
import {
  createOrganization,
  getOrganizationMembers,
} from "../../../src/services/organizations-service.js";

function uniqueEmail(prefix: string): string {
  return `${prefix}-${randomUUID()}@example.com`;
}

async function cleanAll(): Promise<void> {
  await prisma.auditLog.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

describe("organization-members-service 統合テスト (members.list)", () => {
  beforeEach(cleanAll);
  afterAll(async () => {
    await cleanAll();
    await prisma.$disconnect();
  });

  it("組織のメンバー一覧を取得できる", async () => {
    const ownerResult = await registerUser({
      email: uniqueEmail("owner"),
      password: "password123",
    });
    const memberResult = await registerUser({
      email: uniqueEmail("member"),
      password: "password123",
    });
    const viewerResult = await registerUser({
      email: uniqueEmail("viewer"),
      password: "password123",
    });

    expect(
      ownerResult.success && memberResult.success && viewerResult.success,
    ).toBe(true);
    if (
      !ownerResult.success ||
      !memberResult.success ||
      !viewerResult.success
    ) {
      return;
    }

    const organizationResult = await createOrganization({
      name: "Acme Inc.",
      slug: "acme-inc",
      ownerUserId: ownerResult.data.user.id,
    });
    expect(organizationResult.success).toBe(true);
    if (!organizationResult.success) {
      return;
    }

    await prisma.organizationMember.create({
      data: {
        organizationId: organizationResult.data.id,
        userId: memberResult.data.user.id,
        role: "member",
      },
    });
    await prisma.organizationMember.create({
      data: {
        organizationId: organizationResult.data.id,
        userId: viewerResult.data.user.id,
        role: "viewer",
      },
    });

    const result = await getOrganizationMembers({
      organizationId: organizationResult.data.id,
      page: 1,
      perPage: 20,
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.members).toHaveLength(3);
    expect(result.data.total).toBe(3);
    expect(result.data.members).toContainEqual({
      id: expect.any(String),
      userId: ownerResult.data.user.id,
      name: null,
      email: ownerResult.data.user.email,
      role: "owner",
      joinedAt: expect.any(String),
    });
    expect(result.data.members).toContainEqual({
      id: expect.any(String),
      userId: memberResult.data.user.id,
      name: null,
      email: memberResult.data.user.email,
      role: "member",
      joinedAt: expect.any(String),
    });
    expect(result.data.members).toContainEqual({
      id: expect.any(String),
      userId: viewerResult.data.user.id,
      name: null,
      email: viewerResult.data.user.email,
      role: "viewer",
      joinedAt: expect.any(String),
    });
  });

  it("organization_id でフィルタして他組織のメンバーを含めない", async () => {
    const ownerAResult = await registerUser({
      email: uniqueEmail("owner-a"),
      password: "password123",
    });
    const ownerBResult = await registerUser({
      email: uniqueEmail("owner-b"),
      password: "password123",
    });

    expect(ownerAResult.success && ownerBResult.success).toBe(true);
    if (!ownerAResult.success || !ownerBResult.success) {
      return;
    }

    const organizationA = await createOrganization({
      name: "Org A",
      slug: "org-a",
      ownerUserId: ownerAResult.data.user.id,
    });
    const organizationB = await createOrganization({
      name: "Org B",
      slug: "org-b",
      ownerUserId: ownerBResult.data.user.id,
    });

    expect(organizationA.success && organizationB.success).toBe(true);
    if (!organizationA.success || !organizationB.success) {
      return;
    }

    const result = await getOrganizationMembers({
      organizationId: organizationA.data.id,
      page: 1,
      perPage: 20,
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.members).toHaveLength(1);
    expect(result.data.total).toBe(1);
    expect(result.data.members[0]?.userId).toBe(ownerAResult.data.user.id);
  });

  it("ページネーションで取得件数を制限できる", async () => {
    const ownerResult = await registerUser({
      email: uniqueEmail("owner"),
      password: "password123",
    });
    const memberResult = await registerUser({
      email: uniqueEmail("member"),
      password: "password123",
    });

    expect(ownerResult.success && memberResult.success).toBe(true);
    if (!ownerResult.success || !memberResult.success) {
      return;
    }

    const organization = await createOrganization({
      name: "Acme Inc.",
      slug: "acme-inc",
      ownerUserId: ownerResult.data.user.id,
    });
    expect(organization.success).toBe(true);
    if (!organization.success) {
      return;
    }

    await prisma.organizationMember.create({
      data: {
        organizationId: organization.data.id,
        userId: memberResult.data.user.id,
        role: "member",
      },
    });

    const result = await getOrganizationMembers({
      organizationId: organization.data.id,
      page: 1,
      perPage: 1,
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.members).toHaveLength(1);
    expect(result.data.total).toBe(2);
  });

  it("作成順でソートされている", async () => {
    const ownerResult = await registerUser({
      email: uniqueEmail("owner"),
      password: "password123",
    });
    const memberResult = await registerUser({
      email: uniqueEmail("member"),
      password: "password123",
    });

    expect(ownerResult.success && memberResult.success).toBe(true);
    if (!ownerResult.success || !memberResult.success) {
      return;
    }

    const organization = await createOrganization({
      name: "Acme Inc.",
      slug: "acme-inc",
      ownerUserId: ownerResult.data.user.id,
    });
    expect(organization.success).toBe(true);
    if (!organization.success) {
      return;
    }

    await prisma.organizationMember.updateMany({
      where: {
        organizationId: organization.data.id,
        role: "owner",
      },
      data: {
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    await prisma.organizationMember.create({
      data: {
        organizationId: organization.data.id,
        userId: memberResult.data.user.id,
        role: "member",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      },
    });

    const result = await getOrganizationMembers({
      organizationId: organization.data.id,
      page: 1,
      perPage: 20,
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.members.map((member) => member.userId)).toEqual([
      ownerResult.data.user.id,
      memberResult.data.user.id,
    ]);
  });
});

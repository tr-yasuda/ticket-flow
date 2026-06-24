import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../../../src/lib/prisma.js";
import { registerUser } from "../../../src/services/auth-service.js";
import { updateOrganizationMemberRole } from "../../../src/services/organization-members-service.js";
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

afterAll(async () => {
  await cleanAll();
  await prisma.$disconnect();
});

describe("organization-members-service 統合テスト (members.list)", () => {
  beforeEach(cleanAll);

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

describe("updateOrganizationMemberRole", () => {
  beforeEach(cleanAll);

  it("member のロールを admin に変更できる", async () => {
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

    const result = await updateOrganizationMemberRole({
      organizationId: organization.data.id,
      targetUserId: memberResult.data.user.id,
      newRole: "admin",
      actorUserId: ownerResult.data.user.id,
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.member.role).toBe("admin");
    expect(result.data.oldRole).toBe("member");

    const updated = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: organization.data.id,
          userId: memberResult.data.user.id,
        },
      },
    });
    expect(updated?.role).toBe("admin");
  });

  it("最後の Owner のロール変更は失敗する", async () => {
    const ownerResult = await registerUser({
      email: uniqueEmail("owner"),
      password: "password123",
    });

    expect(ownerResult.success).toBe(true);
    if (!ownerResult.success) {
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

    const result = await updateOrganizationMemberRole({
      organizationId: organization.data.id,
      targetUserId: ownerResult.data.user.id,
      newRole: "admin",
      actorUserId: ownerResult.data.user.id,
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.type).toBe("last-owner");

    const unchanged = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: organization.data.id,
          userId: ownerResult.data.user.id,
        },
      },
    });
    expect(unchanged?.role).toBe("owner");
  });

  it("存在しないメンバーのロール変更は失敗する", async () => {
    const ownerResult = await registerUser({
      email: uniqueEmail("owner"),
      password: "password123",
    });
    const otherResult = await registerUser({
      email: uniqueEmail("other"),
      password: "password123",
    });

    expect(ownerResult.success && otherResult.success).toBe(true);
    if (!ownerResult.success || !otherResult.success) {
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

    const result = await updateOrganizationMemberRole({
      organizationId: organization.data.id,
      targetUserId: otherResult.data.user.id,
      newRole: "admin",
      actorUserId: ownerResult.data.user.id,
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.type).toBe("target-not-found");
  });

  it("同じロールへの変更は失敗する", async () => {
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

    const result = await updateOrganizationMemberRole({
      organizationId: organization.data.id,
      targetUserId: memberResult.data.user.id,
      newRole: "member",
      actorUserId: ownerResult.data.user.id,
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.type).toBe("same-role");
  });

  it("複数 Owner がいる場合、一方を admin に降格できる", async () => {
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

    const organization = await createOrganization({
      name: "Acme Inc.",
      slug: "acme-inc",
      ownerUserId: ownerAResult.data.user.id,
    });
    expect(organization.success).toBe(true);
    if (!organization.success) {
      return;
    }

    await prisma.organizationMember.create({
      data: {
        organizationId: organization.data.id,
        userId: ownerBResult.data.user.id,
        role: "owner",
      },
    });

    const result = await updateOrganizationMemberRole({
      organizationId: organization.data.id,
      targetUserId: ownerBResult.data.user.id,
      newRole: "admin",
      actorUserId: ownerAResult.data.user.id,
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.member.role).toBe("admin");

    const ownerCount = await prisma.organizationMember.count({
      where: {
        organizationId: organization.data.id,
        role: "owner",
      },
    });
    expect(ownerCount).toBe(1);
  });

  it("member を owner に昇格できる", async () => {
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

    const result = await updateOrganizationMemberRole({
      organizationId: organization.data.id,
      targetUserId: memberResult.data.user.id,
      newRole: "owner",
      actorUserId: ownerResult.data.user.id,
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.member.role).toBe("owner");
  });

  it("ロール変更時に監査ログが記録される", async () => {
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

    const result = await updateOrganizationMemberRole({
      organizationId: organization.data.id,
      targetUserId: memberResult.data.user.id,
      newRole: "admin",
      actorUserId: ownerResult.data.user.id,
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        organizationId: organization.data.id,
        entityType: "organization_member",
        action: "role_changed",
      },
    });
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]).toMatchObject({
      actorId: ownerResult.data.user.id,
      entityId: result.data.member.id,
      oldValues: { role: "member" },
      newValues: { role: "admin" },
    });
  });
});

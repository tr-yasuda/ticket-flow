import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../../../src/lib/prisma.js";
import { registerUser } from "../../../src/services/auth-service.js";
import {
  createOrganization,
  getOrganizationsByUserId,
} from "../../../src/services/organizations-service.js";

async function cleanAll(): Promise<void> {
  await prisma.organizationMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

describe("organizations-service 統合テスト", () => {
  beforeEach(cleanAll);
  afterAll(async () => {
    await cleanAll();
    await prisma.$disconnect();
  });

  it("createOrganization で組織を作成できる", async () => {
    const userResult = await registerUser({
      email: "owner@example.com",
      password: "password123",
    });
    expect(userResult.success).toBe(true);
    if (!userResult.success) {
      return;
    }

    const result = await createOrganization({
      name: "Acme Inc.",
      slug: "acme-inc",
      ownerUserId: userResult.data.user.id,
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.name).toBe("Acme Inc.");
    expect(result.data.slug).toBe("acme-inc");
  });

  it("createOrganization で重複スラッグを拒否する", async () => {
    const userResult = await registerUser({
      email: "owner@example.com",
      password: "password123",
    });
    expect(userResult.success).toBe(true);
    if (!userResult.success) {
      return;
    }

    await createOrganization({
      name: "Acme Inc.",
      slug: "acme-inc",
      ownerUserId: userResult.data.user.id,
    });

    const result = await createOrganization({
      name: "Acme Corp",
      slug: "acme-inc",
      ownerUserId: userResult.data.user.id,
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.type).toBe("slug-already-exists");
  });

  describe("getOrganizationsByUserId", () => {
    it("ユーザーが所属する組織をロール付きで取得できる", async () => {
      const userResult = await registerUser({
        email: "member@example.com",
        password: "password123",
      });
      expect(userResult.success).toBe(true);
      if (!userResult.success) {
        return;
      }

      const organization = await createOrganization({
        name: "Acme Inc.",
        slug: "acme-inc",
        ownerUserId: userResult.data.user.id,
      });
      expect(organization.success).toBe(true);

      const result = await getOrganizationsByUserId({
        userId: userResult.data.user.id,
      });

      expect(result.success).toBe(true);
      expect(result.data.organizations).toEqual([
        {
          id: expect.any(String),
          name: "Acme Inc.",
          slug: "acme-inc",
          role: "owner",
        },
      ]);
    });

    it("所属組織がない場合は空配列を返す", async () => {
      const userResult = await registerUser({
        email: "nomember@example.com",
        password: "password123",
      });
      expect(userResult.success).toBe(true);
      if (!userResult.success) {
        return;
      }

      const result = await getOrganizationsByUserId({
        userId: userResult.data.user.id,
      });

      expect(result.success).toBe(true);
      expect(result.data.organizations).toEqual([]);
    });

    it("他ユーザーの組織を返さない", async () => {
      const userAResult = await registerUser({
        email: "user-a@example.com",
        password: "password123",
      });
      const userBResult = await registerUser({
        email: "user-b@example.com",
        password: "password123",
      });
      expect(userAResult.success).toBe(true);
      expect(userBResult.success).toBe(true);
      if (!userAResult.success || !userBResult.success) {
        return;
      }

      await createOrganization({
        name: "User A Org",
        slug: "user-a-org",
        ownerUserId: userAResult.data.user.id,
      });

      const result = await getOrganizationsByUserId({
        userId: userBResult.data.user.id,
      });

      expect(result.success).toBe(true);
      expect(result.data.organizations).toEqual([]);
    });

    it("組織名の昇順で返す", async () => {
      const userResult = await registerUser({
        email: "sorted@example.com",
        password: "password123",
      });
      expect(userResult.success).toBe(true);
      if (!userResult.success) {
        return;
      }

      await createOrganization({
        name: "Zeta",
        slug: "zeta",
        ownerUserId: userResult.data.user.id,
      });
      await createOrganization({
        name: "Alpha",
        slug: "alpha",
        ownerUserId: userResult.data.user.id,
      });

      const result = await getOrganizationsByUserId({
        userId: userResult.data.user.id,
      });

      expect(result.success).toBe(true);
      expect(result.data.organizations.map((o) => o.name)).toEqual([
        "Alpha",
        "Zeta",
      ]);
    });
  });
});

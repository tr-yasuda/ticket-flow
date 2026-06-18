import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../../../src/lib/prisma.js";
import { registerUser } from "../../../src/services/auth-service.js";
import { createOrganization } from "../../../src/services/organizations-service.js";

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
});

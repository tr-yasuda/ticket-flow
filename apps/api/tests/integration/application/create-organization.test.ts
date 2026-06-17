import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createOrganization } from "../../../src/application/create-organization.js";
import { createOrganization as createOrganizationEntity } from "../../../src/domain/organization.js";
import { createUser } from "../../../src/domain/user.js";
import { loadDatabaseConfig } from "../../../src/infrastructure/database/config.js";
import { createPrismaClient } from "../../../src/infrastructure/database/prisma-client.js";
import { PrismaOrganizationMemberRepository } from "../../../src/infrastructure/database/prisma-organization-member-repository.js";
import { PrismaOrganizationRepository } from "../../../src/infrastructure/database/prisma-organization-repository.js";
import { PrismaTransactionRunner } from "../../../src/infrastructure/database/prisma-transaction-runner.js";
import { PrismaUserRepository } from "../../../src/infrastructure/database/prisma-user-repository.js";

const config = loadDatabaseConfig(process.env);
const prisma = createPrismaClient(config);
const organizationRepository = new PrismaOrganizationRepository(prisma);
const organizationMemberRepository = new PrismaOrganizationMemberRepository(
  prisma,
);
const userRepository = new PrismaUserRepository(prisma);
const transactionRunner = new PrismaTransactionRunner(prisma);

async function cleanTables(): Promise<void> {
  await prisma.organizationMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
}

describe.sequential("createOrganization 統合テスト", () => {
  beforeEach(cleanTables);
  afterAll(async () => {
    await cleanTables();
    await prisma.$disconnect();
  });

  it("organization.create: 組織と Owner メンバーが作成される", async () => {
    const user = createUser("owner@example.com", "password-hash");
    await userRepository.save(user);

    const result = await createOrganization(
      { name: "Acme Inc.", slug: "acme-inc", ownerUserId: user.id },
      {
        organizationRepository,
        organizationMemberRepository,
        transactionRunner,
      },
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    const organization = await organizationRepository.findById(
      result.data.organization.id,
    );
    expect(organization).not.toBeNull();
    expect(organization?.slug).toBe("acme-inc");

    const member =
      await organizationMemberRepository.findByOrganizationIdAndUserId(
        result.data.organization.id,
        user.id,
      );
    expect(member).not.toBeNull();
    expect(member?.role).toBe("owner");
  });

  it("organization.create: 重複した slug では作成されない", async () => {
    const user = createUser("owner@example.com", "password-hash");
    await userRepository.save(user);
    const existing = createOrganizationEntity("Acme Inc.", "acme-inc");
    await organizationRepository.save(existing);

    const result = await createOrganization(
      { name: "Other", slug: "acme-inc", ownerUserId: user.id },
      {
        organizationRepository,
        organizationMemberRepository,
        transactionRunner,
      },
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe("slug-already-exists");
  });

  it("organization.create: メンバー作成失敗時に組織作成がロールバックされる", async () => {
    await expect(
      createOrganization(
        {
          name: "Acme Inc.",
          slug: "acme-inc",
          ownerUserId: "non-existent-user",
        },
        {
          organizationRepository,
          organizationMemberRepository,
          transactionRunner,
        },
      ),
    ).rejects.toThrow();

    const organization = await organizationRepository.findBySlug("acme-inc");
    expect(organization).toBeNull();
  });
});

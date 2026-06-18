import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  changeRole,
  createOrganizationMember,
  type OrganizationMemberRole,
} from "../../../../src/domain/organization-member.js";
import { createOrganization } from "../../../../src/domain/organization.js";
import { createUser } from "../../../../src/domain/user.js";
import { loadDatabaseConfig } from "../../../../src/infrastructure/database/config.js";
import { createPrismaClient } from "../../../../src/infrastructure/database/prisma-client.js";
import { PrismaOrganizationMemberRepository } from "../../../../src/infrastructure/database/prisma-organization-member-repository.js";
import { PrismaOrganizationRepository } from "../../../../src/infrastructure/database/prisma-organization-repository.js";
import { PrismaUserRepository } from "../../../../src/infrastructure/database/prisma-user-repository.js";

const config = loadDatabaseConfig(process.env);
const prisma = createPrismaClient(config);
const organizationRepository = new PrismaOrganizationRepository(prisma);
const userRepository = new PrismaUserRepository(prisma);
const repository = new PrismaOrganizationMemberRepository(prisma);

async function cleanTables(): Promise<void> {
  await prisma.organizationMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
}

let userCounter = 0;

async function createUserRecord(): Promise<{ id: string; email: string }> {
  userCounter += 1;
  const user = createUser(
    `member-test-user-${userCounter}@example.com`,
    "password-hash",
  );
  await userRepository.save(user);
  return { id: user.id, email: user.email };
}

describe.sequential("PrismaOrganizationMemberRepository 統合テスト", () => {
  beforeEach(cleanTables);
  afterAll(async () => {
    await cleanTables();
    await prisma.$disconnect();
  });

  async function createOrganizationRecord(name: string, slug: string) {
    const organization = createOrganization(name, slug);
    await organizationRepository.save(organization);
    return organization;
  }

  it("メンバーを作成できる", async () => {
    const organization = await createOrganizationRecord(
      "Member Test Org",
      "member-test-org",
    );
    const user = await createUserRecord();
    const member = createOrganizationMember(organization.id, user.id, "owner");

    await repository.save(member);
    const found = await repository.findById(member.id);

    expect(found).toEqual(member);
  });

  it("admin ロールのメンバーを作成できる", async () => {
    const organization = await createOrganizationRecord(
      "Member Test Org Admin",
      "member-test-org-admin",
    );
    const user = await createUserRecord();
    const member = createOrganizationMember(organization.id, user.id, "admin");

    await repository.save(member);
    const found = await repository.findById(member.id);

    expect(found?.role).toBe("admin");
  });

  it("viewer ロールのメンバーを作成できる", async () => {
    const organization = await createOrganizationRecord(
      "Member Test Org Viewer",
      "member-test-org-viewer",
    );
    const user = await createUserRecord();
    const member = createOrganizationMember(organization.id, user.id, "viewer");

    await repository.save(member);
    const found = await repository.findById(member.id);

    expect(found?.role).toBe("viewer");
  });

  it("findByOrganizationIdAndUserId で保存したメンバーを取得できる", async () => {
    const organization = await createOrganizationRecord(
      "Member Test Org",
      "member-test-org-find",
    );
    const user = await createUserRecord();
    const member = createOrganizationMember(organization.id, user.id, "owner");
    await repository.save(member);

    const found = await repository.findByOrganizationIdAndUserId(
      organization.id,
      user.id,
    );

    expect(found).toEqual(member);
  });

  it("findByOrganizationIdAndUserId で存在しない組み合わせに対して null を返す", async () => {
    const found = await repository.findByOrganizationIdAndUserId(
      "org-1",
      "user-1",
    );

    expect(found).toBeNull();
  });

  it("findAll で保存したすべてのメンバーを取得できる", async () => {
    const organization = await createOrganizationRecord(
      "Member Test Org All",
      "member-test-org-all",
    );
    const user1 = await createUserRecord();
    const user2 = await createUserRecord();
    const member1 = createOrganizationMember(
      organization.id,
      user1.id,
      "owner",
    );
    const member2 = createOrganizationMember(
      organization.id,
      user2.id,
      "member",
    );
    await repository.save(member1);
    await repository.save(member2);

    const all = await repository.findAll();

    expect(all).toHaveLength(2);
    expect(all).toContainEqual(member1);
    expect(all).toContainEqual(member2);
  });

  it("save で既存メンバーを上書き更新できる", async () => {
    const organization = await createOrganizationRecord(
      "Member Test Org Update",
      "member-test-org-update",
    );
    const user = await createUserRecord();
    const member = createOrganizationMember(organization.id, user.id, "owner");
    await repository.save(member);

    const updated = { ...member, role: "member" as OrganizationMemberRole };
    await repository.save(updated);

    const found = await repository.findById(member.id);
    expect(found).toEqual(updated);
  });

  it("save でロールを変更できる", async () => {
    const organization = await createOrganizationRecord(
      "Member Test Org Change Role",
      "member-test-org-change-role",
    );
    const user = await createUserRecord();
    const member = createOrganizationMember(organization.id, user.id, "member");
    await repository.save(member);

    const updated = changeRole(member, "admin");
    await repository.save(updated);

    const found = await repository.findById(member.id);
    expect(found).toEqual(updated);
  });

  it("save で重複した組織・ユーザー組み合わせを保存すると更新される", async () => {
    const organization = await createOrganizationRecord(
      "Member Test Org Duplicate",
      "member-test-org-duplicate",
    );
    const user = await createUserRecord();
    const member = createOrganizationMember(organization.id, user.id, "owner");
    await repository.save(member);

    const duplicate = createOrganizationMember(
      organization.id,
      user.id,
      "member",
    );

    await repository.save(duplicate);
    const found = await repository.findByOrganizationIdAndUserId(
      organization.id,
      user.id,
    );

    expect(found).not.toBeNull();
    expect(found?.role).toBe("member");
  });

  it("delete でメンバーを削除できる", async () => {
    const organization = await createOrganizationRecord(
      "Member Test Org Delete",
      "member-test-org-delete",
    );
    const user = await createUserRecord();
    const member = createOrganizationMember(organization.id, user.id, "owner");
    await repository.save(member);

    await repository.delete(member.id);

    const found = await repository.findById(member.id);
    expect(found).toBeNull();
  });

  it("delete で存在しない ID でも例外を投げない", async () => {
    await expect(repository.delete("missing-id")).resolves.toBeUndefined();
  });

  it("findByUserId でユーザーの所属組織をロール付きで取得できる", async () => {
    const organization1 = await createOrganizationRecord("Acme", "acme");
    const organization2 = await createOrganizationRecord("Globex", "globex");
    const user = await createUserRecord();
    const member1 = createOrganizationMember(
      organization1.id,
      user.id,
      "owner",
    );
    const member2 = createOrganizationMember(
      organization2.id,
      user.id,
      "member",
    );
    await repository.save(member1);
    await repository.save(member2);

    const found = await repository.findByUserId(user.id);

    expect(found).toHaveLength(2);
    expect(found).toEqual([
      {
        membershipId: member1.id,
        organizationId: organization1.id,
        userId: user.id,
        role: "owner",
        organizationName: "Acme",
        organizationSlug: "acme",
      },
      {
        membershipId: member2.id,
        organizationId: organization2.id,
        userId: user.id,
        role: "member",
        organizationName: "Globex",
        organizationSlug: "globex",
      },
    ]);
  });

  it("findByUserId で所属組織がない場合は空配列を返す", async () => {
    const user = await createUserRecord();

    const found = await repository.findByUserId(user.id);

    expect(found).toEqual([]);
  });

  it("findByUserId は組織名の昇順で返す", async () => {
    const organizationB = await createOrganizationRecord("Beta", "beta");
    const organizationA = await createOrganizationRecord("Alpha", "alpha");
    const user = await createUserRecord();
    await repository.save(
      createOrganizationMember(organizationB.id, user.id, "viewer"),
    );
    await repository.save(
      createOrganizationMember(organizationA.id, user.id, "admin"),
    );

    const found = await repository.findByUserId(user.id);

    expect(found.map((m) => m.organizationName)).toEqual(["Alpha", "Beta"]);
  });

  it("findByUserId は他のユーザーの組織を返さない", async () => {
    const organizationForUserA = await createOrganizationRecord(
      "User A Org",
      "user-a-org",
    );
    const organizationForUserB = await createOrganizationRecord(
      "User B Org",
      "user-b-org",
    );
    const userA = await createUserRecord();
    const userB = await createUserRecord();
    await repository.save(
      createOrganizationMember(organizationForUserA.id, userA.id, "owner"),
    );
    await repository.save(
      createOrganizationMember(organizationForUserB.id, userB.id, "owner"),
    );

    const foundForUserA = await repository.findByUserId(userA.id);

    expect(foundForUserA).toHaveLength(1);
    expect(foundForUserA[0]?.organizationId).toBe(organizationForUserA.id);
  });
});

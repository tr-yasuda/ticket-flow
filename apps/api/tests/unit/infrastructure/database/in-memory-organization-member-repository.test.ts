import { describe, expect, it } from "vitest";

import {
  changeRole,
  createOrganizationMember,
} from "../../../../src/domain/organization-member.js";
import { createOrganization } from "../../../../src/domain/organization.js";
import { InMemoryOrganizationMemberRepository } from "../../../../src/infrastructure/database/in-memory-organization-member-repository.js";
import { InMemoryOrganizationRepository } from "../../../../src/infrastructure/database/in-memory-organization-repository.js";

describe("InMemoryOrganizationMemberRepository", () => {
  it("id で保存したメンバーを取得できる", async () => {
    const repository = new InMemoryOrganizationMemberRepository();
    const member = createOrganizationMember("org-1", "user-1", "owner");

    await repository.save(member);
    const found = await repository.findById(member.id);

    expect(found).toEqual(member);
  });

  it("organizationId と userId でメンバーを取得できる", async () => {
    const repository = new InMemoryOrganizationMemberRepository();
    const member = createOrganizationMember("org-1", "user-1", "owner");

    await repository.save(member);
    const found = await repository.findByOrganizationIdAndUserId(
      "org-1",
      "user-1",
    );

    expect(found).toEqual(member);
  });

  it("一致するメンバーが存在しない場合は null を返す", async () => {
    const repository = new InMemoryOrganizationMemberRepository();

    const found = await repository.findByOrganizationIdAndUserId(
      "org-1",
      "user-1",
    );

    expect(found).toBeNull();
  });

  it("重複する組織・ユーザー組み合わせを保存すると既存メンバーを更新する", async () => {
    const repository = new InMemoryOrganizationMemberRepository();
    const member = createOrganizationMember("org-1", "user-1", "owner");
    await repository.save(member);

    const duplicate = createOrganizationMember("org-1", "user-1", "member");

    await repository.save(duplicate);
    const found = await repository.findByOrganizationIdAndUserId(
      "org-1",
      "user-1",
    );

    expect(found).not.toBeNull();
    expect(found?.role).toBe("member");
  });

  it("save でロールを変更できる", async () => {
    const repository = new InMemoryOrganizationMemberRepository();
    const member = createOrganizationMember("org-1", "user-1", "member");
    await repository.save(member);

    const updated = changeRole(member, "admin");
    await repository.save(updated);

    const found = await repository.findById(member.id);
    expect(found).toEqual(updated);
  });

  it("findAll で保存したすべてのメンバーを取得できる", async () => {
    const repository = new InMemoryOrganizationMemberRepository();
    const member1 = createOrganizationMember("org-1", "user-1", "owner");
    const member2 = createOrganizationMember("org-1", "user-2", "admin");
    const member3 = createOrganizationMember("org-1", "user-3", "member");
    const member4 = createOrganizationMember("org-1", "user-4", "viewer");

    await repository.save(member1);
    await repository.save(member2);
    await repository.save(member3);
    await repository.save(member4);
    const all = await repository.findAll();

    expect(all).toHaveLength(4);
    expect(all).toContainEqual(member1);
    expect(all).toContainEqual(member2);
    expect(all).toContainEqual(member3);
    expect(all).toContainEqual(member4);
  });

  it("delete でメンバーを削除できる", async () => {
    const repository = new InMemoryOrganizationMemberRepository();
    const member = createOrganizationMember("org-1", "user-1", "owner");
    await repository.save(member);

    await repository.delete(member.id);
    const found = await repository.findById(member.id);

    expect(found).toBeNull();
  });

  describe("findByUserId", () => {
    it("ユーザーが所属する組織をロール付きで取得できる", async () => {
      const organizationRepository = new InMemoryOrganizationRepository();
      const repository = new InMemoryOrganizationMemberRepository(
        organizationRepository,
      );
      const organization = createOrganization("Acme", "acme");
      await organizationRepository.save(organization);
      const member = createOrganizationMember(
        organization.id,
        "user-1",
        "owner",
      );
      await repository.save(member);

      const found = await repository.findByUserId("user-1");

      expect(found).toEqual([
        {
          membershipId: member.id,
          organizationId: organization.id,
          userId: "user-1",
          role: "owner",
          organizationName: "Acme",
          organizationSlug: "acme",
        },
      ]);
    });

    it("所属組織がない場合は空配列を返す", async () => {
      const organizationRepository = new InMemoryOrganizationRepository();
      const repository = new InMemoryOrganizationMemberRepository(
        organizationRepository,
      );

      const found = await repository.findByUserId("user-1");

      expect(found).toEqual([]);
    });

    it("組織名の昇順で返す", async () => {
      const organizationRepository = new InMemoryOrganizationRepository();
      const repository = new InMemoryOrganizationMemberRepository(
        organizationRepository,
      );
      const organizationZ = createOrganization("Zeta", "zeta");
      const organizationA = createOrganization("Alpha", "alpha");
      await organizationRepository.save(organizationZ);
      await organizationRepository.save(organizationA);
      const memberZ = createOrganizationMember(
        organizationZ.id,
        "user-1",
        "member",
      );
      const memberA = createOrganizationMember(
        organizationA.id,
        "user-1",
        "admin",
      );
      await repository.save(memberZ);
      await repository.save(memberA);

      const found = await repository.findByUserId("user-1");

      expect(found.map((m) => m.organizationName)).toEqual(["Alpha", "Zeta"]);
    });

    it("organizationRepository が未注入の場合は空配列を返す", async () => {
      const repository = new InMemoryOrganizationMemberRepository();
      const member = createOrganizationMember("org-1", "user-1", "owner");
      await repository.save(member);

      const found = await repository.findByUserId("user-1");

      expect(found).toEqual([]);
    });

    it("organizationRepository に存在しない組織は結果から除外する", async () => {
      const organizationRepository = new InMemoryOrganizationRepository();
      const repository = new InMemoryOrganizationMemberRepository(
        organizationRepository,
      );
      const member = createOrganizationMember("org-1", "user-1", "owner");
      await repository.save(member);

      const found = await repository.findByUserId("user-1");

      expect(found).toEqual([]);
    });
  });
});

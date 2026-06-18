import { describe, expect, it } from "vitest";

import {
  changeRole,
  createOrganizationMember,
} from "../../../../src/domain/organization-member.js";
import { InMemoryOrganizationMemberRepository } from "../../../../src/infrastructure/database/in-memory-organization-member-repository.js";

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
});

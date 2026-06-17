import { describe, expect, it } from "vitest";

import { createOrganization, rehydrateOrganization } from "./organization.js";

describe("createOrganization", () => {
  it("有効な名前と slug で組織を作成できる", () => {
    const organization = createOrganization("Acme", "acme");

    expect(organization.name).toBe("Acme");
    expect(organization.slug).toBe("acme");
    expect(organization.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("名前の前後の空白はトリムされる", () => {
    const organization = createOrganization("  Acme  ", "acme");

    expect(organization.name).toBe("Acme");
  });

  it("slug の大文字は小文字に正規化される", () => {
    const organization = createOrganization("Acme", "ACME-CORP");

    expect(organization.slug).toBe("acme-corp");
  });

  it("空の名前ではエラー", () => {
    expect(() => createOrganization("", "acme")).toThrow("name is required");
  });

  it("空白のみの名前ではエラー", () => {
    expect(() => createOrganization("   ", "acme")).toThrow("name is required");
  });

  it("200 文字を超える名前ではエラー", () => {
    const longName = "a".repeat(201);
    expect(() => createOrganization(longName, "acme")).toThrow(
      "Organization name must be 200 characters or fewer",
    );
  });

  it("空の slug ではエラー", () => {
    expect(() => createOrganization("Acme", "")).toThrow(
      "slug format is invalid",
    );
  });

  it("許可されない文字を含む slug ではエラー", () => {
    expect(() => createOrganization("Acme", "acme corp")).toThrow(
      "slug format is invalid",
    );
    expect(() => createOrganization("Acme", "acme_corp")).toThrow(
      "slug format is invalid",
    );
  });

  it("ハイフンで繋がれた英数字の slug は有効", () => {
    const organization = createOrganization("Acme", "acme-corp-123");

    expect(organization.slug).toBe("acme-corp-123");
  });

  it("先頭または末尾がハイフンの slug ではエラー", () => {
    expect(() => createOrganization("Acme", "-acme")).toThrow(
      "slug format is invalid",
    );
    expect(() => createOrganization("Acme", "acme-")).toThrow(
      "slug format is invalid",
    );
  });

  it("連続するハイフンの slug ではエラー", () => {
    expect(() => createOrganization("Acme", "acme--corp")).toThrow(
      "slug format is invalid",
    );
  });
});

describe("rehydrateOrganization", () => {
  it("保存済みデータから組織を復元できる", () => {
    const organization = rehydrateOrganization("org-1", "Acme", "acme");

    expect(organization).toEqual({
      id: "org-1",
      name: "Acme",
      slug: "acme",
    });
  });

  it("無効な値ではエラー", () => {
    expect(() => rehydrateOrganization("org-1", "", "acme")).toThrow(
      "name is required",
    );
    expect(() => rehydrateOrganization("org-1", "Acme", "Acme Corp")).toThrow(
      "slug format is invalid",
    );
  });
});

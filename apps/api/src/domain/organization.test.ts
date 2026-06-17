import { describe, expect, it } from "vitest";

import { createOrganization, rehydrateOrganization } from "./organization.js";

describe("createOrganization", () => {
  it("有効な名前と slug で組織を作成できる", () => {
    const organization = createOrganization("Acme", "acme");

    expect(organization.name).toBe("Acme");
    expect(organization.slug).toBe("acme");
    expect(typeof organization.id).toBe("string");
    expect(organization.id).not.toBe("");
  });

  it("空の名前ではエラー", () => {
    expect(() => createOrganization("", "acme")).toThrow("name is required");
  });

  it("空白のみの名前ではエラー", () => {
    expect(() => createOrganization("   ", "acme")).toThrow("name is required");
  });

  it("空の slug ではエラー", () => {
    expect(() => createOrganization("Acme", "")).toThrow("slug is required");
  });

  it("slug に許可されない文字が含まれる場合はエラー", () => {
    expect(() => createOrganization("Acme", "acme corp")).toThrow(
      "slug format is invalid",
    );
    expect(() => createOrganization("Acme", "acme_corp")).toThrow(
      "slug format is invalid",
    );
    expect(() => createOrganization("Acme", "Acme")).toThrow(
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

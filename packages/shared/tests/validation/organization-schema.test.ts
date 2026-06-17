import { describe, expect, it } from "vitest";

import { createOrganizationInputSchema } from "../../src/validation/organization-schema.js";

describe("createOrganizationInputSchema", () => {
  it("有効な組織名と slug を受け入れる", () => {
    const result = createOrganizationInputSchema.safeParse({
      name: "Acme Inc.",
      slug: "acme-inc",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({ name: "Acme Inc.", slug: "acme-inc" });
  });

  it("空の name を拒否する", () => {
    const result = createOrganizationInputSchema.safeParse({
      name: "",
      slug: "acme-inc",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.path).toEqual(["name"]);
  });

  it("空白のみの name を拒否する", () => {
    const result = createOrganizationInputSchema.safeParse({
      name: "   ",
      slug: "acme-inc",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.path).toEqual(["name"]);
  });

  it("name の前後空白をトリムする", () => {
    const result = createOrganizationInputSchema.safeParse({
      name: "  Acme Inc.  ",
      slug: "acme-inc",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.name).toBe("Acme Inc.");
  });

  it("長すぎる name を拒否する", () => {
    const result = createOrganizationInputSchema.safeParse({
      name: "a".repeat(201),
      slug: "acme-inc",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.path).toEqual(["name"]);
  });

  it("空の slug を拒否する", () => {
    const result = createOrganizationInputSchema.safeParse({
      name: "Acme Inc.",
      slug: "",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.path).toEqual(["slug"]);
  });

  it("空白のみの slug を拒否する", () => {
    const result = createOrganizationInputSchema.safeParse({
      name: "Acme Inc.",
      slug: "   ",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.path).toEqual(["slug"]);
  });

  it("slug の前後空白をトリムする", () => {
    const result = createOrganizationInputSchema.safeParse({
      name: "Acme Inc.",
      slug: "  acme-inc  ",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.slug).toBe("acme-inc");
  });

  it("大文字を含む slug を拒否する", () => {
    const result = createOrganizationInputSchema.safeParse({
      name: "Acme Inc.",
      slug: "Acme-Inc",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.path).toEqual(["slug"]);
  });

  it("先頭がハイフンの slug を拒否する", () => {
    const result = createOrganizationInputSchema.safeParse({
      name: "Acme Inc.",
      slug: "-acme",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.path).toEqual(["slug"]);
  });

  it("末尾がハイフンの slug を拒否する", () => {
    const result = createOrganizationInputSchema.safeParse({
      name: "Acme Inc.",
      slug: "acme-",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.path).toEqual(["slug"]);
  });

  it("連続したハイフンを含む slug を拒否する", () => {
    const result = createOrganizationInputSchema.safeParse({
      name: "Acme Inc.",
      slug: "acme--inc",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.path).toEqual(["slug"]);
  });

  it("特殊文字を含む slug を拒否する", () => {
    const result = createOrganizationInputSchema.safeParse({
      name: "Acme Inc.",
      slug: "acme_inc",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.path).toEqual(["slug"]);
  });

  it("長すぎる slug を拒否する", () => {
    const result = createOrganizationInputSchema.safeParse({
      name: "Acme Inc.",
      slug: "a".repeat(201),
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.path).toEqual(["slug"]);
  });

  it("name が欠けている場合を拒否する", () => {
    const result = createOrganizationInputSchema.safeParse({
      slug: "acme-inc",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.path).toEqual(["name"]);
  });

  it("slug が欠けている場合を拒否する", () => {
    const result = createOrganizationInputSchema.safeParse({
      name: "Acme Inc.",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.path).toEqual(["slug"]);
  });
});

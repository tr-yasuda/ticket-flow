import { describe, expect, it } from "vitest";

import { organizationOnboardingSchema } from "@/lib/schemas/organization-onboarding-schema";
import { generateSlug } from "@/lib/slugs";

describe("organizationOnboardingSchema", () => {
  it("有効な組織名を許容する", () => {
    const result = organizationOnboardingSchema.safeParse({ name: "Demo Org" });
    expect(result.success).toBe(true);
  });

  it("空の組織名を拒否する", () => {
    const result = organizationOnboardingSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("前後の空白をトリムして検証する", () => {
    const result = organizationOnboardingSchema.safeParse({ name: "   " });
    expect(result.success).toBe(false);
  });
});

describe("generateSlug", () => {
  it("英数字とスペースからスラッグを生成する", () => {
    expect(generateSlug("Demo Organization")).toBe("demo-organization");
  });

  it("大文字を小文字に変換する", () => {
    expect(generateSlug("ACME Corp")).toBe("acme-corp");
  });

  it("日本語名からはフォールバックスラッグを返す", () => {
    const slug = generateSlug("株式会社アクセル");
    expect(slug.startsWith("org-")).toBe(true);
  });

  it("空文字列からはフォールバックスラッグを返す", () => {
    const slug = generateSlug("");
    expect(slug.startsWith("org-")).toBe(true);
  });

  it("200 文字境界で末尾のハイフンを除去する", () => {
    const name = "a".repeat(199) + " ";
    const slug = generateSlug(name);

    expect(slug).toBe("a".repeat(199));
    expect(slug.endsWith("-")).toBe(false);
  });
});

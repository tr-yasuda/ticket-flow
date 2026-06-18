import { describe, expect, it } from "vitest";

import { createOrganization, getOrganizations } from "@/lib/organizations-api";

describe("organizations-api", () => {
  it("組織一覧を取得できる", async () => {
    const data = await getOrganizations();

    expect(data.organizations).toHaveLength(1);
    expect(data.organizations[0]).toMatchObject({
      id: "demo-org-001",
      name: "Demo Organization",
      slug: "demo-organization",
      role: "owner",
    });
  });

  it("組織を作成できる", async () => {
    const organization = await createOrganization({
      name: "New Org",
      slug: "new-org",
    });

    expect(organization).toMatchObject({
      id: "mock-new-org-id",
      name: "New Org",
      slug: "new-org",
    });
  });
});

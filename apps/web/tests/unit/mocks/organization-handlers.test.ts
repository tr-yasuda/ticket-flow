import { createApiSuccessResponse } from "@ticket-flow/shared";
import { describe, expect, it } from "vitest";

import { apiClient } from "@/lib/api-client";

describe("organization mock handlers", () => {
  it("デモ組織を取得できる", async () => {
    const response = await apiClient.get("organizations/demo-org-001").json();

    expect(response).toEqual(
      createApiSuccessResponse({
        id: "demo-org-001",
        name: "Demo Organization",
        slug: "demo-organization",
        role: "owner",
      }),
    );
  });

  it("存在しない組織は 404", async () => {
    await expect(
      apiClient.get("organizations/not-found").json(),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("組織を作成できる", async () => {
    const response = await apiClient
      .post("organizations", { json: { name: "New Org" } })
      .json();

    expect(response).toEqual(
      createApiSuccessResponse({
        id: "mock-new-org-id",
        name: "New Org",
        slug: "new-org",
      }),
    );
  });

  it("slug を指定して組織を作成できる", async () => {
    const response = await apiClient
      .post("organizations", { json: { name: "New Org", slug: "custom-slug" } })
      .json();

    expect(response).toEqual(
      createApiSuccessResponse({
        id: "mock-new-org-id",
        name: "New Org",
        slug: "custom-slug",
      }),
    );
  });

  it("組織名が空では 400", async () => {
    await expect(
      apiClient.post("organizations", { json: { name: "" } }).json(),
    ).rejects.toMatchObject({ status: 400 });
  });
});

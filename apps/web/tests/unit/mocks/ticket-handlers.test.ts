import { createApiSuccessResponse } from "@ticket-flow/shared";
import { describe, expect, it } from "vitest";

import { apiClient } from "@/lib/api-client";

describe("ticket mock handlers", () => {
  it("デモ組織のチケット一覧を取得できる", async () => {
    const response = await apiClient
      .get("organizations/demo-org-001/tickets")
      .json();

    expect(response.success).toBe(true);
    expect(Array.isArray(response.data)).toBe(true);
    expect(response.data).toHaveLength(4);
  });

  it("存在しない組織のチケット一覧は空配列", async () => {
    const response = await apiClient
      .get("organizations/other-org/tickets")
      .json();

    expect(response).toEqual(createApiSuccessResponse([]));
  });

  it("特定のチケットを取得できる", async () => {
    const response = await apiClient
      .get("organizations/demo-org-001/tickets/demo-ticket-001")
      .json();

    expect(response).toEqual(
      createApiSuccessResponse({
        id: "demo-ticket-001",
        organizationId: "demo-org-001",
        title: "ログイン画面の UI 改善",
        status: "open",
      }),
    );
  });

  it("存在しないチケットは 404", async () => {
    await expect(
      apiClient.get("organizations/demo-org-001/tickets/not-found").json(),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("チケットを作成できる", async () => {
    const response = await apiClient
      .post("organizations/demo-org-001/tickets", {
        json: { title: "New Ticket" },
      })
      .json();

    expect(response.success).toBe(true);
    expect(response.data.title).toBe("New Ticket");
    expect(response.data.organizationId).toBe("demo-org-001");
  });

  it("タイトルが空では 400", async () => {
    await expect(
      apiClient
        .post("organizations/demo-org-001/tickets", { json: { title: "" } })
        .json(),
    ).rejects.toMatchObject({ status: 400 });
  });
});

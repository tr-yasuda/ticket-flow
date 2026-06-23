import {
  createApiPaginatedSuccessResponse,
  type ApiPaginatedSuccessResponse,
  type ApiSuccessResponse,
} from "@ticket-flow/shared";
import { describe, expect, it } from "vitest";

import { apiClient } from "@/lib/api-client";
import type { MockTicket } from "@/mocks/data/tickets.js";

describe("ticket mock handlers", () => {
  it("デモ組織のチケット一覧を取得できる", async () => {
    const response = await apiClient
      .get("organizations/demo-org-001/tickets")
      .json<ApiPaginatedSuccessResponse<{ tickets: MockTicket[] }>>();

    expect(response.success).toBe(true);
    expect(Array.isArray(response.data.tickets)).toBe(true);
    expect(response.data.tickets).toHaveLength(4);
    expect(response.meta).toEqual({
      page: 1,
      perPage: 20,
      total: 4,
      totalPages: 1,
    });
  });

  it("存在しない組織のチケット一覧は空配列", async () => {
    const response = await apiClient
      .get("organizations/other-org/tickets")
      .json();

    expect(response).toEqual(
      createApiPaginatedSuccessResponse(
        { tickets: [] },
        { page: 1, perPage: 20, total: 0, totalPages: 1 },
      ),
    );
  });

  it("特定のチケットを取得できる", async () => {
    const response = await apiClient
      .get("organizations/demo-org-001/tickets/demo-ticket-001")
      .json<ApiSuccessResponse<MockTicket>>();

    expect(response.success).toBe(true);
    expect(response.data.id).toBe("demo-ticket-001");
    expect(response.data.organizationId).toBe("demo-org-001");
    expect(response.data.title).toBe("ログイン画面の UI 改善");
    expect(response.data.status).toBe("open");
    expect(response.data.priority).toBe("medium");
    expect(response.data.assignee).toEqual({
      id: "demo-user-001",
      name: "山田太郎",
    });
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
      .json<ApiSuccessResponse<MockTicket>>();

    expect(response.success).toBe(true);
    expect(response.data.title).toBe("New Ticket");
    expect(response.data.organizationId).toBe("demo-org-001");
    expect(response.data.status).toBe("open");
    expect(response.data.priority).toBe("medium");
    expect(response.data.createdBy).toBe("mock-user-id");
  });

  it("タイトルが空では 400", async () => {
    await expect(
      apiClient
        .post("organizations/demo-org-001/tickets", { json: { title: "" } })
        .json(),
    ).rejects.toMatchObject({
      status: 400,
      message: "入力内容を確認してください",
      details: expect.arrayContaining([
        expect.objectContaining({ field: "title" }),
      ]),
    });
  });

  it("shared schema で無効な priority は 400", async () => {
    await expect(
      apiClient
        .post("organizations/demo-org-001/tickets", {
          json: { title: "New Ticket", priority: "invalid" },
        })
        .json(),
    ).rejects.toMatchObject({
      status: 400,
      message: "入力内容を確認してください",
      details: expect.arrayContaining([
        expect.objectContaining({ field: "priority" }),
      ]),
    });
  });

  it("作成時に status を送信すると 400", async () => {
    await expect(
      apiClient
        .post("organizations/demo-org-001/tickets", {
          json: { title: "New Ticket", status: "closed" },
        })
        .json(),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("説明と担当者を反映して作成できる", async () => {
    const response = await apiClient
      .post("organizations/demo-org-001/tickets", {
        json: {
          title: "New Ticket",
          description: "詳細説明",
          priority: "high",
          assigneeId: "demo-user-002",
        },
      })
      .json<ApiSuccessResponse<MockTicket>>();

    expect(response.success).toBe(true);
    expect(response.data.description).toBe("詳細説明");
    expect(response.data.priority).toBe("high");
    expect(response.data.assignee).toEqual({
      id: "demo-user-002",
      name: "佐藤花子",
    });
  });
});

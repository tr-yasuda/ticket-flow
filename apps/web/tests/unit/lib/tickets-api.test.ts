import { createApiSuccessResponse } from "@ticket-flow/shared";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTicket } from "@/lib/tickets-api";
import { server } from "@/mocks/server.js";

describe("tickets-api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("チケットを作成できる", async () => {
    const ticket = await createTicket("demo-org-001", {
      title: "新規チケット",
      description: "説明",
      priority: "high",
      assigneeId: null,
    });

    expect(ticket).toMatchObject({
      id: "mock-new-ticket-id",
      organizationId: "demo-org-001",
      title: "新規チケット",
      description: "説明",
      status: "open",
      priority: "high",
      assigneeId: null,
    });
  });

  it("organizationId を URL エンコードする", async () => {
    const organizationId = "org/with/slash";
    let capturedUrl = "";

    server.use(
      http.post("/api/organizations/:id/tickets", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json(
          createApiSuccessResponse({
            id: "ticket-1",
            organizationId,
            title: "encoded",
            description: null,
            status: "open",
            priority: "medium",
            assigneeId: null,
            createdBy: "user-1",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
          { status: 201 },
        );
      }),
    );

    await createTicket(organizationId, { title: "encoded" });

    expect(capturedUrl).toContain(
      `/api/organizations/${encodeURIComponent(organizationId)}/tickets`,
    );
  });

  it("不正なレスポンスの場合はエラーを投げる", async () => {
    server.use(
      http.post("/api/organizations/:id/tickets", () => {
        return HttpResponse.json(
          createApiSuccessResponse({
            id: "ticket-1",
            organizationId: "demo-org-001",
            title: "missing fields",
          }),
          { status: 201 },
        );
      }),
    );

    await expect(
      createTicket("demo-org-001", { title: "missing fields" }),
    ).rejects.toThrow("Invalid response");
  });
});

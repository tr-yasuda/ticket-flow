import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../../../src/lib/prisma.js";
import { createApp } from "../../../src/routes/index.js";
import {
  addMember,
  cleanAll,
  createOrganization,
  registerUser,
  uniqueEmail,
} from "../helpers/organization-test-helpers.js";

async function createTicket(
  app: ReturnType<typeof createApp>,
  token: string,
  orgId: string,
  title: string,
  options?: {
    description?: string;
    assigneeId?: string;
  },
): Promise<string> {
  const res = await app.request(`/api/organizations/${orgId}/tickets`, {
    method: "POST",
    body: JSON.stringify({ title, ...options }),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const body = await res.json();
  return body.data.id as string;
}

async function updateTicket(
  app: ReturnType<typeof createApp>,
  token: string,
  orgId: string,
  ticketId: string,
  payload: Record<string, unknown>,
): Promise<Response> {
  return app.request(`/api/organizations/${orgId}/tickets/${ticketId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
}

async function getTicketHistory(
  app: ReturnType<typeof createApp>,
  token: string,
  orgId: string,
  ticketId: string,
  query?: { page?: number; perPage?: number },
): Promise<Response> {
  const searchParams = new URLSearchParams();
  if (query?.page !== undefined) {
    searchParams.set("page", String(query.page));
  }
  if (query?.perPage !== undefined) {
    searchParams.set("perPage", String(query.perPage));
  }
  const queryString = searchParams.toString();
  const path = `/api/organizations/${orgId}/tickets/${ticketId}/history${queryString ? `?${queryString}` : ""}`;
  return app.request(path, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
}

describe("GET /api/organizations/:organizationId/tickets/:ticketId/history (ticket.history)", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    await cleanAll();
    app = createApp();
  });

  afterAll(async () => {
    await cleanAll();
  });

  it("Owner がチケット変更履歴を取得できる", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    const ticketId = await createTicket(
      app,
      ownerToken,
      organizationId,
      "履歴確認",
    );

    const response = await getTicketHistory(
      app,
      ownerToken,
      organizationId,
      ticketId,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.history).toEqual(expect.any(Array));
    expect(body.data.history).toHaveLength(1);
    expect(body.meta).toEqual({
      page: 1,
      perPage: 20,
      total: 1,
      totalPages: 1,
    });
    const entry = body.data.history[0];
    expect(entry).toHaveProperty("id");
    expect(entry).toHaveProperty("actor");
    expect(entry).toHaveProperty("action");
    expect(entry).toHaveProperty("oldValues");
    expect(entry).toHaveProperty("newValues");
    expect(entry).toHaveProperty("createdAt");
  });

  it("Admin がチケット変更履歴を取得できる", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const { userId: adminUserId, accessToken: adminToken } = await registerUser(
      app,
      uniqueEmail("admin"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    await addMember(organizationId, adminUserId, "admin");
    const ticketId = await createTicket(
      app,
      ownerToken,
      organizationId,
      "admin 閲覧",
    );

    const response = await getTicketHistory(
      app,
      adminToken,
      organizationId,
      ticketId,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.history).toHaveLength(1);
  });

  it("Member がチケット変更履歴を取得できる", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const { userId: memberUserId, accessToken: memberToken } =
      await registerUser(app, uniqueEmail("member"), "password123");
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    await addMember(organizationId, memberUserId, "member");
    const ticketId = await createTicket(
      app,
      ownerToken,
      organizationId,
      "member 閲覧",
    );

    const response = await getTicketHistory(
      app,
      memberToken,
      organizationId,
      ticketId,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.history).toHaveLength(1);
  });

  it("Viewer がチケット変更履歴を取得できる", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const { userId: viewerUserId, accessToken: viewerToken } =
      await registerUser(app, uniqueEmail("viewer"), "password123");
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    await addMember(organizationId, viewerUserId, "viewer");
    const ticketId = await createTicket(
      app,
      ownerToken,
      organizationId,
      "viewer 閲覧",
    );

    const response = await getTicketHistory(
      app,
      viewerToken,
      organizationId,
      ticketId,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.history).toHaveLength(1);
  });

  it("変更履歴が時系列順に返される", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    const ticketId = await createTicket(
      app,
      ownerToken,
      organizationId,
      "時系列確認",
    );
    await updateTicket(app, ownerToken, organizationId, ticketId, {
      title: "更新 1",
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });
    await updateTicket(app, ownerToken, organizationId, ticketId, {
      title: "更新 2",
    });

    const response = await getTicketHistory(
      app,
      ownerToken,
      organizationId,
      ticketId,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    const history = body.data.history as Array<{
      action: string;
      newValues: { title?: string } | null;
      createdAt: string;
    }>;
    expect(history).toHaveLength(3);
    const titles = history
      .filter((item) => item.action === "update" && item.newValues?.title)
      .map((item) => item.newValues?.title);
    expect(titles).toEqual(["更新 2", "更新 1"]);
    for (let i = 0; i < history.length - 1; i++) {
      expect(
        new Date(history[i]?.createdAt as string).getTime(),
      ).toBeGreaterThanOrEqual(
        new Date(history[i + 1]?.createdAt as string).getTime(),
      );
    }
  });

  it("各履歴に変更者、変更内容、変更日時が含まれる", async () => {
    const { userId: ownerUserId, accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    const ticketId = await createTicket(
      app,
      ownerToken,
      organizationId,
      "内容確認",
    );

    const response = await getTicketHistory(
      app,
      ownerToken,
      organizationId,
      ticketId,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    const history = body.data.history as Array<{
      id: string;
      actor: { id: string; name: string | null } | null;
      action: string;
      oldValues: Record<string, unknown> | null;
      newValues: Record<string, unknown> | null;
      createdAt: string;
    }>;
    expect(history).toHaveLength(1);
    const createLog = history.find((item) => item.action === "create");
    expect(createLog).toBeDefined();
    expect(createLog?.actor).not.toBeNull();
    expect(createLog?.actor?.id).toBe(ownerUserId);
    expect(createLog?.actor).not.toHaveProperty("email");
    expect(createLog?.newValues).not.toBeNull();
    expect(createLog?.newValues).toHaveProperty("title");
    expect(createLog?.createdAt).toEqual(expect.any(String));
  });

  it("oldValues と newValues に正しい変更前後の値が入る", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    const ticketId = await createTicket(
      app,
      ownerToken,
      organizationId,
      "差分確認",
    );
    await updateTicket(app, ownerToken, organizationId, ticketId, {
      title: "更新後タイトル",
    });

    const response = await getTicketHistory(
      app,
      ownerToken,
      organizationId,
      ticketId,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    const history = body.data.history as Array<{
      action: string;
      oldValues: { title?: string } | null;
      newValues: { title?: string } | null;
    }>;
    const updateLog = history.find((item) => item.action === "update");
    expect(updateLog).toBeDefined();
    expect(updateLog?.oldValues?.title).toBe("差分確認");
    expect(updateLog?.newValues?.title).toBe("更新後タイトル");
  });

  it("actor が null の履歴は actor: null で返る", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    const ticketId = await createTicket(
      app,
      ownerToken,
      organizationId,
      "null actor",
    );
    await prisma.auditLog.create({
      data: {
        organizationId,
        actorId: null,
        entityType: "ticket",
        entityId: ticketId,
        action: "manual",
        newValues: { note: "system operation" },
      },
    });

    const response = await getTicketHistory(
      app,
      ownerToken,
      organizationId,
      ticketId,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    const history = body.data.history as Array<{
      action: string;
      actor: unknown;
    }>;
    const manualLog = history.find((item) => item.action === "manual");
    expect(manualLog).toBeDefined();
    expect(manualLog?.actor).toBeNull();
  });

  it("ページネーションパラメータで件数を制御できる", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    const ticketId = await createTicket(
      app,
      ownerToken,
      organizationId,
      "ページネーション",
    );
    await updateTicket(app, ownerToken, organizationId, ticketId, {
      title: "更新 1",
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });
    await updateTicket(app, ownerToken, organizationId, ticketId, {
      title: "更新 2",
    });

    const firstPage = await getTicketHistory(
      app,
      ownerToken,
      organizationId,
      ticketId,
      { page: 1, perPage: 2 },
    );
    expect(firstPage.status).toBe(200);
    const firstBody = await firstPage.json();
    expect(firstBody.data.history).toHaveLength(2);
    expect(firstBody.meta).toEqual({
      page: 1,
      perPage: 2,
      total: 3,
      totalPages: 2,
    });

    const secondPage = await getTicketHistory(
      app,
      ownerToken,
      organizationId,
      ticketId,
      { page: 2, perPage: 2 },
    );
    expect(secondPage.status).toBe(200);
    const secondBody = await secondPage.json();
    expect(secondBody.data.history).toHaveLength(1);
    expect(secondBody.meta).toEqual({
      page: 2,
      perPage: 2,
      total: 3,
      totalPages: 2,
    });
  });

  it("無効な page パラメータは 400 Bad Request", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    const ticketId = await createTicket(
      app,
      ownerToken,
      organizationId,
      "invalid page",
    );

    const response = await getTicketHistory(
      app,
      ownerToken,
      organizationId,
      ticketId,
      { page: 0 },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("他組織のチケットは 404 Not Found", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const { userId: otherUserId, accessToken: otherToken } = await registerUser(
      app,
      uniqueEmail("other"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    const otherOrganizationId = await createOrganization(
      app,
      ownerToken,
      "Other Inc.",
      "other-inc",
    );
    await addMember(otherOrganizationId, otherUserId, "member");
    const ticketId = await createTicket(
      app,
      ownerToken,
      organizationId,
      "cross org ticket",
    );

    const response = await getTicketHistory(
      app,
      otherToken,
      otherOrganizationId,
      ticketId,
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("存在しないチケットは 404 Not Found", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );

    const response = await getTicketHistory(
      app,
      ownerToken,
      organizationId,
      randomUUID(),
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("未認証の場合は 401 Unauthorized", async () => {
    const response = await app.request(
      "/api/organizations/550e8400-e29b-41d4-a716-446655440000/tickets/550e8400-e29b-41d4-a716-446655440001/history",
      { method: "GET" },
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_UNAUTHORIZED");
  });

  it("組織に所属しない認証ユーザーは 403 Forbidden", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const { accessToken: otherToken } = await registerUser(
      app,
      uniqueEmail("other"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    const ticketId = await createTicket(
      app,
      ownerToken,
      organizationId,
      "private ticket",
    );

    const response = await getTicketHistory(
      app,
      otherToken,
      organizationId,
      ticketId,
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_FORBIDDEN");
  });

  it("大文字の ticketId でもチケット変更履歴を取得できる", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    const ticketId = await createTicket(
      app,
      ownerToken,
      organizationId,
      "uppercase id ticket",
    );
    const upperTicketId = ticketId.toUpperCase();

    const response = await getTicketHistory(
      app,
      ownerToken,
      organizationId,
      upperTicketId,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.history).toHaveLength(1);
  });

  it("無効な ticketId の場合は 400 Bad Request", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );

    const response = await getTicketHistory(
      app,
      ownerToken,
      organizationId,
      "invalid-ticket-id",
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "ticketId" })]),
    );
  });

  it("無効な organizationId の場合は 400 Bad Request", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    await createOrganization(app, ownerToken, "Acme Inc.", "acme-inc");

    const response = await app.request(
      "/api/organizations/invalid-id/tickets/550e8400-e29b-41d4-a716-446655440001/history",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${ownerToken}` },
      },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "organizationId" }),
      ]),
    );
  });

  it("論理削除済みのチケットは 404 Not Found", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    const ticketId = await createTicket(
      app,
      ownerToken,
      organizationId,
      "deleted ticket",
    );
    const deleteRes = await app.request(
      `/api/organizations/${organizationId}/tickets/${ticketId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${ownerToken}` },
      },
    );
    expect(deleteRes.status).toBe(204);

    const response = await getTicketHistory(
      app,
      ownerToken,
      organizationId,
      ticketId,
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

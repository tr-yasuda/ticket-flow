import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../../../src/lib/prisma.js";
import { createApp } from "../../../src/routes/index.js";
import {
  cleanAll,
  createOrganization,
  registerUser,
  uniqueEmail,
} from "../helpers/organization-test-helpers.js";

async function addMember(
  organizationId: string,
  userId: string,
  role: "admin" | "member" | "viewer",
): Promise<void> {
  await prisma.organizationMember.create({
    data: { organizationId, userId, role },
  });
}

async function createTicket(
  app: ReturnType<typeof createApp>,
  token: string,
  orgId: string,
  title: string,
  options?: { description?: string },
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

async function updateTicketRequest(
  app: ReturnType<typeof createApp>,
  token: string,
  orgId: string,
  ticketId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return app.request(`/api/organizations/${orgId}/tickets/${ticketId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
}

describe("PATCH /api/organizations/:organizationId/tickets/:ticketId (ticket.update)", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    await cleanAll();
    app = createApp();
  });
  afterAll(async () => {
    await cleanAll();
  });

  it("Owner がタイトルと説明を部分更新できる", async () => {
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
      "before",
      {
        description: "old description",
      },
    );

    const response = await updateTicketRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
      {
        title: "after",
        description: "new description",
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(ticketId);
    expect(body.data.title).toBe("after");
    expect(body.data.description).toBe("new description");
  });

  it("更新時に監査ログに old/new values が記録される", async () => {
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
      "old title",
      {
        description: "old description",
      },
    );

    const response = await updateTicketRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
      {
        title: "new title",
        description: "new description",
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);

    const logs = await prisma.auditLog.findMany({
      where: {
        organizationId,
        entityType: "ticket",
        entityId: ticketId,
        action: "update",
      },
    });
    expect(logs).toHaveLength(1);
    const log = logs[0];
    expect(log).not.toBeUndefined();
    expect(log?.actorId).toBe(ownerUserId);
    expect(log?.oldValues).toMatchObject({
      title: "old title",
      description: "old description",
    });
    expect(log?.newValues).toMatchObject({
      title: "new title",
      description: "new description",
    });
  });

  it("Member がタイトルと説明を部分更新できる", async () => {
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
      "before",
    );

    const response = await updateTicketRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      {
        title: "after",
        description: "new description",
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.title).toBe("after");
    expect(body.data.description).toBe("new description");
  });

  it("Admin がタイトルと説明を部分更新できる", async () => {
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
      "before",
    );

    const response = await updateTicketRequest(
      app,
      adminToken,
      organizationId,
      ticketId,
      {
        title: "after",
        description: "new description",
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.title).toBe("after");
  });

  it("Viewer は更新できず 403 Forbidden", async () => {
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
      "before",
    );

    const response = await updateTicketRequest(
      app,
      viewerToken,
      organizationId,
      ticketId,
      {
        title: "after",
      },
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_FORBIDDEN");
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

    const response = await updateTicketRequest(
      app,
      ownerToken,
      organizationId,
      randomUUID(),
      { title: "after" },
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
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
      "cross org",
    );

    const response = await updateTicketRequest(
      app,
      otherToken,
      otherOrganizationId,
      ticketId,
      { title: "hacked" },
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("description を省略しても既存値が保持される", async () => {
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
      "before",
      {
        description: "keep me",
      },
    );

    const response = await updateTicketRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
      {
        title: "title only",
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.title).toBe("title only");
    expect(body.data.description).toBe("keep me");
  });

  it("説明を空文字にすると null になる", async () => {
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
      "before",
      {
        description: "old",
      },
    );

    const response = await updateTicketRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
      {
        description: "   ",
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.description).toBeNull();
  });

  it("空タイトルは 400 Bad Request", async () => {
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
      "before",
    );

    const response = await updateTicketRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
      {
        title: "   ",
      },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "title" })]),
    );
  });

  it("未認証の場合は 401 Unauthorized", async () => {
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
      "before",
    );

    const response = await app.request(
      `/api/organizations/${organizationId}/tickets/${ticketId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ title: "after" }),
        headers: { "Content-Type": "application/json" },
      },
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_UNAUTHORIZED");
  });

  it("無効な organizationId の場合は 400 Bad Request", async () => {
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
      "before",
    );

    const response = await app.request(
      `/api/organizations/invalid-id/tickets/${ticketId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ title: "after" }),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
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

    const response = await updateTicketRequest(
      app,
      ownerToken,
      organizationId,
      "invalid-ticket-id",
      { title: "after" },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "ticketId" })]),
    );
  });

  it("大文字の ticketId でも更新できる", async () => {
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
      "before",
    );
    const upperTicketId = ticketId.toUpperCase();

    const response = await updateTicketRequest(
      app,
      ownerToken,
      organizationId,
      upperTicketId,
      { title: "after" },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(ticketId);
    expect(body.data.title).toBe("after");
  });

  it("description: null で説明をクリアできる", async () => {
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
      "before",
      {
        description: "old description",
      },
    );

    const response = await updateTicketRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
      { description: null },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.description).toBeNull();
  });

  it("空ボディは 400 Bad Request", async () => {
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
      "before",
    );

    const response = await updateTicketRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
      {},
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "title" }),
        expect.objectContaining({ field: "description" }),
      ]),
    );
  });

  it("未知のフィールドは 400 Bad Request", async () => {
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
      "before",
    );

    const response = await updateTicketRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
      { title: "after", priority: "high" },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("更新成功レスポンスに commentCount が含まれる", async () => {
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
      "before",
    );

    const response = await updateTicketRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
      { title: "after" },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.commentCount).toBe(0);
  });
});

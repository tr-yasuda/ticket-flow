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
): Promise<string> {
  const res = await app.request(`/api/organizations/${orgId}/tickets`, {
    method: "POST",
    body: JSON.stringify({ title }),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const body = await res.json();
  return body.data.id as string;
}

async function updateTicketStatusRequest(
  app: ReturnType<typeof createApp>,
  token: string,
  orgId: string,
  ticketId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return app.request(`/api/organizations/${orgId}/tickets/${ticketId}/status`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
}

describe("PATCH /api/organizations/:organizationId/tickets/:ticketId/status", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    await cleanAll();
    app = createApp();
  });
  afterAll(async () => {
    await cleanAll();
  });

  it("Owner がステータスを変更できる", async () => {
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
      "task",
    );

    const response = await updateTicketStatusRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
      { status: "in-progress" },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(ticketId);
    expect(body.data.status).toBe("in-progress");
    expect(body.data.commentCount).toBe(0);

    const logs = await prisma.auditLog.findMany({
      where: {
        organizationId,
        entityType: "ticket",
        entityId: ticketId,
        action: "update_status",
      },
    });
    expect(logs).toHaveLength(1);
    const log = logs[0];
    expect(log).not.toBeUndefined();
    expect(log?.actorId).toBe(ownerUserId);
    expect(log?.oldValues).toMatchObject({ status: "open" });
    expect(log?.newValues).toMatchObject({ status: "in-progress" });
  });

  it("Member がステータスを変更できる", async () => {
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
      "task",
    );

    const response = await updateTicketStatusRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      { status: "in-progress" },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("in-progress");
    expect(body.data.commentCount).toBe(0);
  });

  it("Admin がステータスを変更できる", async () => {
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
      "task",
    );

    const response = await updateTicketStatusRequest(
      app,
      adminToken,
      organizationId,
      ticketId,
      { status: "closed" },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("closed");
    expect(body.data.commentCount).toBe(0);
  });

  it("Viewer はステータスを変更できず 403 Forbidden", async () => {
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
      "task",
    );

    const response = await updateTicketStatusRequest(
      app,
      viewerToken,
      organizationId,
      ticketId,
      { status: "in-progress" },
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

    const response = await updateTicketStatusRequest(
      app,
      ownerToken,
      organizationId,
      randomUUID(),
      { status: "in-progress" },
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
      "task",
    );

    const response = await updateTicketStatusRequest(
      app,
      otherToken,
      otherOrganizationId,
      ticketId,
      { status: "in-progress" },
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("無効なステータス遷移は 400 Bad Request", async () => {
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
      "task",
    );

    const first = await updateTicketStatusRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
      { status: "closed" },
    );
    expect(first.status).toBe(200);

    const response = await updateTicketStatusRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
      { status: "open" },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("同じステータスへの更新は冪等に成功する", async () => {
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
      "task",
    );
    const before = await prisma.ticket.findUnique({
      where: { id: ticketId, organizationId },
    });
    expect(before).not.toBeNull();

    const response = await updateTicketStatusRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
      { status: "open" },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("open");

    const after = await prisma.ticket.findUnique({
      where: { id: ticketId, organizationId },
    });
    expect(after).not.toBeNull();
    expect(after?.updatedAt.getTime()).toBe(before?.updatedAt.getTime());

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        organizationId,
        entityType: "ticket",
        entityId: ticketId,
        action: "update_status",
      },
    });
    expect(auditLogs).toHaveLength(0);
  });

  it("無効なステータス値は 400 Bad Request", async () => {
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
      "task",
    );

    const response = await updateTicketStatusRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
      { status: "resolved" },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "status" })]),
    );
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
      "task",
    );

    const response = await updateTicketStatusRequest(
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
      expect.arrayContaining([expect.objectContaining({ field: "status" })]),
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
      "task",
    );

    const response = await updateTicketStatusRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
      { status: "in-progress", priority: "high" },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "priority" })]),
    );
  });

  it("無効な遷移後にステータスと監査ログが変更されていない", async () => {
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
      "task",
    );

    const first = await updateTicketStatusRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
      { status: "closed" },
    );
    expect(first.status).toBe(200);

    const before = await prisma.ticket.findUnique({
      where: { id: ticketId, organizationId },
    });

    const response = await updateTicketStatusRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
      { status: "open" },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "status" })]),
    );

    const after = await prisma.ticket.findUnique({
      where: { id: ticketId, organizationId },
    });
    expect(after?.status).toBe("closed");
    expect(after?.updatedAt.getTime()).toBe(before?.updatedAt.getTime());

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        organizationId,
        entityType: "ticket",
        entityId: ticketId,
        action: "update_status",
      },
    });
    expect(auditLogs).toHaveLength(1);
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
      "task",
    );

    const response = await app.request(
      `/api/organizations/${organizationId}/tickets/${ticketId}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "in-progress" }),
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
      "task",
    );

    const response = await app.request(
      `/api/organizations/invalid-id/tickets/${ticketId}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "in-progress" }),
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

    const response = await updateTicketStatusRequest(
      app,
      ownerToken,
      organizationId,
      "invalid-ticket-id",
      { status: "in-progress" },
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
      "task",
    );
    const upperTicketId = ticketId.toUpperCase();

    const response = await updateTicketStatusRequest(
      app,
      ownerToken,
      organizationId,
      upperTicketId,
      { status: "in-progress" },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(ticketId);
    expect(body.data.status).toBe("in-progress");
  });
});

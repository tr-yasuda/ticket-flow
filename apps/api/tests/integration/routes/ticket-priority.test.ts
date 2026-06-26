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

async function updateTicketPriorityRequest(
  app: ReturnType<typeof createApp>,
  token: string,
  orgId: string,
  ticketId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return app.request(
    `/api/organizations/${orgId}/tickets/${ticketId}/priority`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );
}

describe("PATCH /api/organizations/:organizationId/tickets/:ticketId/priority", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    await cleanAll();
    app = createApp();
  });
  afterAll(async () => {
    await cleanAll();
  });

  it("Owner が優先度を変更できる", async () => {
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
    const before = await prisma.ticket.findUnique({
      where: { id: ticketId, organizationId },
    });
    expect(before).not.toBeNull();

    const response = await updateTicketPriorityRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
      { priority: "urgent" },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(ticketId);
    expect(body.data.priority).toBe("urgent");
    expect(body.data.commentCount).toBe(0);

    const after = await prisma.ticket.findUnique({
      where: { id: ticketId, organizationId },
    });
    expect(after).not.toBeNull();
    expect(after?.updatedAt.getTime()).toBeGreaterThan(
      before?.updatedAt.getTime() ?? 0,
    );

    const logs = await prisma.auditLog.findMany({
      where: {
        organizationId,
        entityType: "ticket",
        entityId: ticketId,
        action: "update_priority",
      },
    });
    expect(logs).toHaveLength(1);
    const log = logs[0];
    expect(log).not.toBeUndefined();
    expect(log?.actorId).toBe(ownerUserId);
    expect(log?.oldValues).toMatchObject({ priority: "medium" });
    expect(log?.newValues).toMatchObject({ priority: "urgent" });
  });

  it("Member が優先度を変更できる", async () => {
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

    const response = await updateTicketPriorityRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      { priority: "high" },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.priority).toBe("high");
    expect(body.data.commentCount).toBe(0);
  });

  it("Admin が優先度を変更できる", async () => {
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

    const response = await updateTicketPriorityRequest(
      app,
      adminToken,
      organizationId,
      ticketId,
      { priority: "low" },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.priority).toBe("low");
    expect(body.data.commentCount).toBe(0);
  });

  it("Viewer は優先度を変更できず 403 Forbidden", async () => {
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

    const response = await updateTicketPriorityRequest(
      app,
      viewerToken,
      organizationId,
      ticketId,
      { priority: "high" },
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

    const response = await updateTicketPriorityRequest(
      app,
      ownerToken,
      organizationId,
      randomUUID(),
      { priority: "high" },
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

    const response = await updateTicketPriorityRequest(
      app,
      otherToken,
      otherOrganizationId,
      ticketId,
      { priority: "high" },
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("無効な優先度値は 400 Bad Request", async () => {
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

    const response = await updateTicketPriorityRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
      { priority: "critical" },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "priority" })]),
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

    const response = await updateTicketPriorityRequest(
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
      expect.arrayContaining([expect.objectContaining({ field: "priority" })]),
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

    const response = await updateTicketPriorityRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
      { priority: "high", status: "in-progress" },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "status" })]),
    );
  });

  it("同じ優先度への更新は冪等に成功する", async () => {
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

    const response = await updateTicketPriorityRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
      { priority: "medium" },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.priority).toBe("medium");

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
        action: "update_priority",
      },
    });
    expect(auditLogs).toHaveLength(0);
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
      `/api/organizations/${organizationId}/tickets/${ticketId}/priority`,
      {
        method: "PATCH",
        body: JSON.stringify({ priority: "high" }),
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
      `/api/organizations/invalid-id/tickets/${ticketId}/priority`,
      {
        method: "PATCH",
        body: JSON.stringify({ priority: "high" }),
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

    const response = await updateTicketPriorityRequest(
      app,
      ownerToken,
      organizationId,
      "invalid-ticket-id",
      { priority: "high" },
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

    const response = await updateTicketPriorityRequest(
      app,
      ownerToken,
      organizationId,
      upperTicketId,
      { priority: "urgent" },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(ticketId);
    expect(body.data.priority).toBe("urgent");
  });
});

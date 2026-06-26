import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { type UpdateTicketAssigneeBody } from "../../../src/controllers/schemas/ticket-schema.js";
import { prisma } from "../../../src/lib/prisma.js";
import { createApp } from "../../../src/routes/index.js";
import {
  addMember,
  cleanAll,
  createOrganization,
  registerUser,
  uniqueEmail,
} from "../helpers/organization-test-helpers.js";

type CreateTicketBody = {
  title: string;
  assigneeId?: string;
};

async function createTicket(
  app: ReturnType<typeof createApp>,
  token: string,
  orgId: string,
  title: string,
  assigneeId?: string,
): Promise<string> {
  const body: CreateTicketBody = { title };
  if (assigneeId !== undefined) {
    body.assigneeId = assigneeId;
  }
  const res = await app.request(`/api/organizations/${orgId}/tickets`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const resBody = await res.json();
  return resBody.data.id as string;
}

async function updateTicketAssigneeRequest(
  app: ReturnType<typeof createApp>,
  token: string,
  orgId: string,
  ticketId: string,
  body: UpdateTicketAssigneeBody,
): Promise<Response> {
  return app.request(
    `/api/organizations/${orgId}/tickets/${ticketId}/assignee`,
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

async function seedAssigneeOrganization(
  app: ReturnType<typeof createApp>,
): Promise<{
  ownerUserId: string;
  ownerToken: string;
  organizationId: string;
  ticketId: string;
}> {
  const { userId: ownerUserId, accessToken: ownerToken } = await registerUser(
    app,
    uniqueEmail("owner"),
    "password123",
  );
  const organizationId = await createOrganization(
    app,
    ownerToken,
    "Acme Inc.",
    `acme-${randomUUID()}`,
  );
  const ticketId = await createTicket(app, ownerToken, organizationId, "task");
  return { ownerUserId, ownerToken, organizationId, ticketId };
}

describe("PATCH /api/organizations/:organizationId/tickets/:ticketId/assignee", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    await cleanAll();
    app = createApp();
  });
  afterAll(async () => {
    await cleanAll();
  });

  it("Owner が組織メンバーを担当者に設定できる", async () => {
    const { userId: ownerUserId, accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const { userId: memberUserId } = await registerUser(
      app,
      uniqueEmail("member"),
      "password123",
    );
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
    const before = await prisma.ticket.findUnique({
      where: { id: ticketId, organizationId },
    });
    expect(before).not.toBeNull();

    const response = await updateTicketAssigneeRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
      { assigneeId: memberUserId },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(ticketId);
    expect(body.data.assigneeId).toBe(memberUserId);
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
        action: "update_assignee",
      },
    });
    expect(logs).toHaveLength(1);
    const log = logs[0];
    expect(log).not.toBeUndefined();
    expect(log?.actorId).toBe(ownerUserId);
    expect(log?.oldValues).toMatchObject({ assigneeId: null });
    expect(log?.newValues).toMatchObject({ assigneeId: memberUserId });
  });

  it("Member が担当者を変更できる", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const { userId: memberUserId, accessToken: memberToken } =
      await registerUser(app, uniqueEmail("member"), "password123");
    const { userId: assigneeUserId } = await registerUser(
      app,
      uniqueEmail("assignee"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    await addMember(organizationId, memberUserId, "member");
    await addMember(organizationId, assigneeUserId, "viewer");
    const ticketId = await createTicket(
      app,
      ownerToken,
      organizationId,
      "task",
    );

    const response = await updateTicketAssigneeRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      { assigneeId: assigneeUserId },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.assigneeId).toBe(assigneeUserId);
    expect(body.data.commentCount).toBe(0);
  });

  it("Admin が担当者を変更できる", async () => {
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
    const { userId: assigneeUserId } = await registerUser(
      app,
      uniqueEmail("assignee"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    await addMember(organizationId, adminUserId, "admin");
    await addMember(organizationId, assigneeUserId, "member");
    const ticketId = await createTicket(
      app,
      ownerToken,
      organizationId,
      "task",
    );

    const response = await updateTicketAssigneeRequest(
      app,
      adminToken,
      organizationId,
      ticketId,
      { assigneeId: assigneeUserId },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.assigneeId).toBe(assigneeUserId);
    expect(body.data.commentCount).toBe(0);
  });

  it("Viewer は担当者を変更できず 403 Forbidden", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const { userId: viewerUserId, accessToken: viewerToken } =
      await registerUser(app, uniqueEmail("viewer"), "password123");
    const { userId: assigneeUserId } = await registerUser(
      app,
      uniqueEmail("assignee"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    await addMember(organizationId, viewerUserId, "viewer");
    await addMember(organizationId, assigneeUserId, "member");
    const ticketId = await createTicket(
      app,
      ownerToken,
      organizationId,
      "task",
    );

    const response = await updateTicketAssigneeRequest(
      app,
      viewerToken,
      organizationId,
      ticketId,
      { assigneeId: assigneeUserId },
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_FORBIDDEN");
  });

  it("存在しないチケットは 404 Not Found", async () => {
    const { ownerToken, organizationId } = await seedAssigneeOrganization(app);

    const response = await updateTicketAssigneeRequest(
      app,
      ownerToken,
      organizationId,
      randomUUID(),
      { assigneeId: randomUUID() },
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("他組織のチケットは 404 Not Found", async () => {
    const { ownerToken, ticketId } = await seedAssigneeOrganization(app);
    const { userId: otherUserId, accessToken: otherToken } = await registerUser(
      app,
      uniqueEmail("other"),
      "password123",
    );
    const otherOrganizationId = await createOrganization(
      app,
      ownerToken,
      "Other Inc.",
      `other-${randomUUID()}`,
    );
    await addMember(otherOrganizationId, otherUserId, "member");

    const response = await updateTicketAssigneeRequest(
      app,
      otherToken,
      otherOrganizationId,
      ticketId,
      { assigneeId: otherUserId },
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("組織に所属していないユーザーを担当者に設定すると 400 Bad Request", async () => {
    const { ownerToken, organizationId, ticketId } =
      await seedAssigneeOrganization(app);
    const { userId: outsideUserId } = await registerUser(
      app,
      uniqueEmail("outside"),
      "password123",
    );

    const response = await updateTicketAssigneeRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
      { assigneeId: outsideUserId },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "assigneeId" }),
      ]),
    );
  });

  it("担当者を null に設定して割り当てを解除できる", async () => {
    const { ownerUserId, ownerToken, organizationId } =
      await seedAssigneeOrganization(app);
    const { userId: memberUserId } = await registerUser(
      app,
      uniqueEmail("member"),
      "password123",
    );
    await addMember(organizationId, memberUserId, "member");
    const ticketId = await createTicket(
      app,
      ownerToken,
      organizationId,
      "task",
      memberUserId,
    );

    const response = await updateTicketAssigneeRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
      { assigneeId: null },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.assigneeId).toBeNull();

    const logs = await prisma.auditLog.findMany({
      where: {
        organizationId,
        entityType: "ticket",
        entityId: ticketId,
        action: "update_assignee",
      },
    });
    expect(logs).toHaveLength(1);
    const log = logs[0];
    expect(log).not.toBeUndefined();
    expect(log?.actorId).toBe(ownerUserId);
    expect(log?.oldValues).toMatchObject({ assigneeId: memberUserId });
    expect(log?.newValues).toMatchObject({ assigneeId: null });
  });

  it("無効な assigneeId は 400 Bad Request", async () => {
    const { ownerToken, organizationId, ticketId } =
      await seedAssigneeOrganization(app);

    const response = await updateTicketAssigneeRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
      { assigneeId: "invalid-id" },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "assigneeId" }),
      ]),
    );
  });

  it("空ボディは 400 Bad Request", async () => {
    const { ownerToken, organizationId, ticketId } =
      await seedAssigneeOrganization(app);

    const response = await updateTicketAssigneeRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
      // @ts-expect-error assigneeId を省略して空ボディをテストする
      {},
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "assigneeId" }),
      ]),
    );
  });

  it("未知のフィールドは 400 Bad Request", async () => {
    const { ownerToken, organizationId, ticketId } =
      await seedAssigneeOrganization(app);

    const response = await updateTicketAssigneeRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
      // @ts-expect-error 未知のフィールドを許可しないことをテストする
      { assigneeId: randomUUID(), priority: "high" },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "priority" })]),
    );
  });

  it("同じ担当者への更新は冪等に成功する", async () => {
    const { ownerToken, organizationId } = await seedAssigneeOrganization(app);
    const { userId: memberUserId } = await registerUser(
      app,
      uniqueEmail("member"),
      "password123",
    );
    await addMember(organizationId, memberUserId, "member");
    const ticketId = await createTicket(
      app,
      ownerToken,
      organizationId,
      "task",
      memberUserId,
    );
    const before = await prisma.ticket.findUnique({
      where: { id: ticketId, organizationId },
    });
    expect(before).not.toBeNull();

    const response = await updateTicketAssigneeRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
      { assigneeId: memberUserId },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.assigneeId).toBe(memberUserId);

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
        action: "update_assignee",
      },
    });
    expect(auditLogs).toHaveLength(0);
  });

  it("未認証の場合は 401 Unauthorized", async () => {
    const { organizationId, ticketId } = await seedAssigneeOrganization(app);

    const response = await app.request(
      `/api/organizations/${organizationId}/tickets/${ticketId}/assignee`,
      {
        method: "PATCH",
        body: JSON.stringify({ assigneeId: randomUUID() }),
        headers: { "Content-Type": "application/json" },
      },
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_UNAUTHORIZED");
  });

  it("無効な organizationId の場合は 400 Bad Request", async () => {
    const { ownerToken, ticketId } = await seedAssigneeOrganization(app);

    const response = await app.request(
      `/api/organizations/invalid-id/tickets/${ticketId}/assignee`,
      {
        method: "PATCH",
        body: JSON.stringify({ assigneeId: randomUUID() }),
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
    const { ownerToken, organizationId } = await seedAssigneeOrganization(app);

    const response = await updateTicketAssigneeRequest(
      app,
      ownerToken,
      organizationId,
      "invalid-ticket-id",
      { assigneeId: randomUUID() },
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
    const { ownerToken, organizationId, ticketId } =
      await seedAssigneeOrganization(app);
    const { userId: memberUserId } = await registerUser(
      app,
      uniqueEmail("member"),
      "password123",
    );
    await addMember(organizationId, memberUserId, "member");
    const upperTicketId = ticketId.toUpperCase();

    const response = await updateTicketAssigneeRequest(
      app,
      ownerToken,
      organizationId,
      upperTicketId,
      { assigneeId: memberUserId },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(ticketId);
    expect(body.data.assigneeId).toBe(memberUserId);
  });
});

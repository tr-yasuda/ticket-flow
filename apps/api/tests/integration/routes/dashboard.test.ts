import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../../../src/lib/prisma.js";
import { createApp } from "../../../src/routes/index.js";
import {
  addMember,
  cleanAll,
  createOrganization,
  createTicketRequest,
  registerUser,
  uniqueEmail,
} from "../helpers/organization-test-helpers.js";

describe("GET /api/organizations/:organizationId/dashboard", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    await cleanAll();
    app = createApp();
  });
  afterAll(async () => {
    await cleanAll();
  });

  async function getDashboardRequest(
    accessToken: string,
    organizationId: string,
  ): Promise<Response> {
    return app.request(`/api/organizations/${organizationId}/dashboard`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  it("Owner が組織のダッシュボードを取得できる", async () => {
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

    const response = await getDashboardRequest(ownerToken, organizationId);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.ticketSummary).toEqual({
      total: 0,
      open: 0,
      inProgress: 0,
      closed: 0,
      undone: 0,
    });
    expect(body.data.prioritySummary).toEqual({
      low: 0,
      medium: 0,
      high: 0,
      urgent: 0,
    });
    expect(body.data.mySummary).toEqual({
      assignedUndone: 0,
    });
    expect(body.data.recentActivity).toEqual([]);
  });

  it.each(["admin", "member", "viewer"] as const)(
    "%s ロールでもダッシュボードを閲覧できる",
    async (role) => {
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

      const { userId, accessToken } = await registerUser(
        app,
        uniqueEmail(role),
        "password123",
      );
      await addMember(organizationId, userId, role);

      const response = await getDashboardRequest(accessToken, organizationId);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
    },
  );

  it("チケット総数、ステータス別集計、優先度別集計、未完了数を返す", async () => {
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

    const tickets = [
      { status: "open", priority: "high" },
      { status: "open", priority: "medium" },
      { status: "in-progress", priority: "low" },
      { status: "closed", priority: "urgent" },
      { status: "closed", priority: "high" },
    ] as const;

    for (const [index, { status, priority }] of tickets.entries()) {
      const response = await createTicketRequest(
        app,
        ownerToken,
        organizationId,
        {
          title: `ticket ${index + 1}`,
          priority,
        },
      );
      const body = await response.json();
      await prisma.ticket.update({
        where: { id: body.data.id },
        data: { status },
      });
    }

    const response = await getDashboardRequest(ownerToken, organizationId);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.ticketSummary).toEqual({
      total: 5,
      open: 2,
      inProgress: 1,
      closed: 2,
      undone: 3,
    });
    expect(body.data.prioritySummary).toEqual({
      low: 1,
      medium: 1,
      high: 2,
      urgent: 1,
    });
  });

  it("owner の担当未完了チケット数を返す", async () => {
    const { accessToken: ownerToken, userId: ownerUserId } = await registerUser(
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

    await createTicketRequest(app, ownerToken, organizationId, {
      title: "assigned open",
      assigneeId: ownerUserId,
    });

    const response = await getDashboardRequest(ownerToken, organizationId);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.mySummary).toEqual({
      assignedUndone: 1,
    });
  });

  it("member は自身の担当未完了数を返す", async () => {
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

    await createTicketRequest(app, ownerToken, organizationId, {
      title: "assigned to member",
      assigneeId: memberUserId,
    });

    const response = await getDashboardRequest(memberToken, organizationId);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.mySummary).toEqual({
      assignedUndone: 1,
    });
  });

  it("完了・削除・未アサインは集計から除外する", async () => {
    const { accessToken: ownerToken, userId: ownerUserId } = await registerUser(
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

    const assignedClosedResponse = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      {
        title: "assigned closed",
        assigneeId: ownerUserId,
      },
    );
    const assignedClosedBody = await assignedClosedResponse.json();
    await prisma.ticket.update({
      where: { id: assignedClosedBody.data.id },
      data: { status: "closed" },
    });

    await createTicketRequest(app, ownerToken, organizationId, {
      title: "unassigned",
    });

    const deletedResponse = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      {
        title: "deleted",
        assigneeId: ownerUserId,
      },
    );
    const deletedBody = await deletedResponse.json();
    await prisma.ticket.update({
      where: { id: deletedBody.data.id },
      data: { deletedAt: new Date() },
    });

    const response = await getDashboardRequest(ownerToken, organizationId);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.mySummary).toEqual({
      assignedUndone: 0,
    });
    expect(body.data.ticketSummary).toEqual({
      total: 2,
      open: 1,
      inProgress: 0,
      closed: 1,
      undone: 1,
    });
  });

  it("アサイン変更後は owner の担当数が減少する", async () => {
    const { accessToken: ownerToken, userId: ownerUserId } = await registerUser(
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

    const assignedOpenResponse = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      {
        title: "assigned open",
        assigneeId: ownerUserId,
      },
    );
    const assignedOpenBody = await assignedOpenResponse.json();

    await prisma.ticket.update({
      where: { id: assignedOpenBody.data.id },
      data: { assigneeId: memberUserId },
    });

    const afterReassignResponse = await getDashboardRequest(
      ownerToken,
      organizationId,
    );

    expect(afterReassignResponse.status).toBe(200);
    const afterReassignBody = await afterReassignResponse.json();
    expect(afterReassignBody.success).toBe(true);
    expect(afterReassignBody.data.mySummary).toEqual({
      assignedUndone: 0,
    });
  });

  it("他組織のデータは含まれない", async () => {
    const { accessToken: ownerAToken } = await registerUser(
      app,
      uniqueEmail("owner-a"),
      "password123",
    );
    const { accessToken: ownerBToken } = await registerUser(
      app,
      uniqueEmail("owner-b"),
      "password123",
    );
    const organizationAId = await createOrganization(
      app,
      ownerAToken,
      "Org A",
      "org-a",
    );
    const organizationBId = await createOrganization(
      app,
      ownerBToken,
      "Org B",
      "org-b",
    );

    await createTicketRequest(app, ownerAToken, organizationAId, {
      title: "org a ticket",
    });
    await createTicketRequest(app, ownerBToken, organizationBId, {
      title: "org b ticket",
    });

    const aResponse = await getDashboardRequest(ownerAToken, organizationAId);

    expect(aResponse.status).toBe(200);
    const aBody = await aResponse.json();
    expect(aBody.success).toBe(true);
    expect(aBody.data.ticketSummary).toEqual({
      total: 1,
      open: 1,
      inProgress: 0,
      closed: 0,
      undone: 1,
    });
    expect(aBody.data.recentActivity).toHaveLength(1);
    const aActivityId = aBody.data.recentActivity[0].entityId;

    const bResponse = await getDashboardRequest(ownerBToken, organizationBId);

    expect(bResponse.status).toBe(200);
    const bBody = await bResponse.json();
    expect(bBody.success).toBe(true);
    expect(bBody.data.recentActivity).toHaveLength(1);
    const bActivityId = bBody.data.recentActivity[0].entityId;

    expect(aActivityId).not.toBe(bActivityId);
  });

  it("最近の活動を監査ログから返す", async () => {
    const { accessToken: ownerToken, userId: ownerUserId } = await registerUser(
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

    const ticketResponse = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      {
        title: "recent ticket",
      },
    );
    const ticketBody = await ticketResponse.json();

    const response = await getDashboardRequest(ownerToken, organizationId);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.recentActivity).toHaveLength(1);
    expect(body.data.recentActivity[0]).toEqual({
      id: expect.any(String),
      entityType: "ticket",
      entityId: ticketBody.data.id,
      action: "create",
      actor: {
        id: ownerUserId,
        name: null,
      },
      createdAt: expect.any(String),
    });
  });

  it("actor が null の監査ログも正しく返す", async () => {
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

    await prisma.auditLog.create({
      data: {
        organizationId,
        actorId: null,
        entityType: "ticket",
        entityId: randomUUID(),
        action: "delete",
        oldValues: null,
        newValues: null,
      },
    });

    const response = await getDashboardRequest(ownerToken, organizationId);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.recentActivity).toHaveLength(1);
    expect(body.data.recentActivity[0]).toEqual({
      id: expect.any(String),
      entityType: "ticket",
      entityId: expect.any(String),
      action: "delete",
      actor: null,
      createdAt: expect.any(String),
    });
  });

  it("最近の活動は最大10件、作成日時の降順で返す", async () => {
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

    const now = Date.now();
    for (let i = 0; i < 12; i += 1) {
      await prisma.auditLog.create({
        data: {
          organizationId,
          actorId: null,
          entityType: "ticket",
          entityId: randomUUID(),
          action: "create",
          oldValues: null,
          newValues: null,
          createdAt: new Date(now + i * 1000),
        },
      });
    }

    const response = await getDashboardRequest(ownerToken, organizationId);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.recentActivity).toHaveLength(10);

    let previousCreatedAt: string | undefined;
    for (const activity of body.data.recentActivity) {
      if (previousCreatedAt !== undefined) {
        expect(new Date(activity.createdAt).getTime()).toBeLessThanOrEqual(
          new Date(previousCreatedAt).getTime(),
        );
      }
      previousCreatedAt = activity.createdAt;
    }
  });

  it("組織に所属していないユーザーは 403 を返す", async () => {
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

    const response = await getDashboardRequest(otherToken, organizationId);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_FORBIDDEN");
  });

  it("無効な organizationId の場合は 400 を返す", async () => {
    const { accessToken } = await registerUser(
      app,
      uniqueEmail("user"),
      "password123",
    );

    const response = await getDashboardRequest(accessToken, "invalid-id");

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("未認証の場合は 401 を返す", async () => {
    const response = await app.request(
      "/api/organizations/550e8400-e29b-41d4-a716-446655440000/dashboard",
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_UNAUTHORIZED");
  });

  it("存在しない organizationId の場合は 403 を返す", async () => {
    const { accessToken } = await registerUser(
      app,
      uniqueEmail("user"),
      "password123",
    );

    const response = await getDashboardRequest(accessToken, randomUUID());

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_FORBIDDEN");
  });
});

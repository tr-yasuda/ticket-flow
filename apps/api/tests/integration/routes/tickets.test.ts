import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../../../src/lib/prisma.js";
import { createApp } from "../../../src/routes/index.js";
import {
  cleanAll,
  createOrganization,
  createTicketRequest,
  registerUser,
  uniqueEmail,
} from "../helpers/organization-test-helpers.js";

async function addMember(
  organizationId: string,
  userId: string,
  role: "admin" | "member" | "viewer",
): Promise<void> {
  await prisma.organizationMember.create({
    data: {
      organizationId,
      userId,
      role,
    },
  });
}

describe("POST /api/organizations/:organizationId/tickets (ticket.create)", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    await cleanAll();
    app = createApp();
  });
  afterAll(async () => {
    await cleanAll();
  });

  it("Owner がタイトルと説明でチケットを作成できる", async () => {
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

    const response = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      {
        title: "新規チケット",
        description: "チケットの説明",
      },
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toEqual(expect.any(String));
    expect(body.data.title).toBe("新規チケット");
    expect(body.data.description).toBe("チケットの説明");
    expect(body.data.status).toBe("open");
    expect(body.data.priority).toBe("medium");
    expect(body.data.organizationId).toBe(organizationId);
  });

  it("Member がチケットを作成できる", async () => {
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

    const response = await createTicketRequest(
      app,
      memberToken,
      organizationId,
      {
        title: "member ticket",
      },
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.title).toBe("member ticket");
    expect(body.data.createdBy).toBe(memberUserId);
  });

  it("Admin がチケットを作成できる", async () => {
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

    const response = await createTicketRequest(
      app,
      adminToken,
      organizationId,
      {
        title: "admin ticket",
      },
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  it("作成者が created_by に設定される", async () => {
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

    const response = await createTicketRequest(
      app,
      memberToken,
      organizationId,
      {
        title: "created by member",
      },
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.createdBy).toBe(memberUserId);

    const stored = await prisma.ticket.findUnique({
      where: { id: body.data.id },
    });
    expect(stored).not.toBeNull();
    expect(stored?.createdBy).toBe(memberUserId);
  });

  it("priority と assigneeId を任意指定できる", async () => {
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

    const response = await createTicketRequest(
      app,
      memberToken,
      organizationId,
      {
        title: "priority and assignee",
        priority: "high",
        assigneeId: memberUserId,
      },
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.priority).toBe("high");
    expect(body.data.assigneeId).toBe(memberUserId);
  });

  it("assigneeId に null を指定できる", async () => {
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

    const response = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      {
        title: "explicit null assignee",
        assigneeId: null,
      },
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.assigneeId).toBeNull();
  });

  it("priority を省略すると medium がデフォルトになる", async () => {
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

    const response = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      {
        title: "default priority",
      },
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.priority).toBe("medium");
  });

  it("status を指定しても作成時は open になる", async () => {
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

    const response = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      {
        title: "status ignored ticket",
        status: "closed",
      },
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("open");
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

    const response = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      {
        title: "empty description",
        description: "   ",
      },
    );

    expect(response.status).toBe(201);
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

    const response = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
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

  it("title を省略すると 400 Bad Request", async () => {
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

    const response = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      {},
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "title" })]),
    );
  });

  it("無効な priority は 400 Bad Request", async () => {
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

    const response = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      {
        title: "invalid priority",
        priority: "invalid",
      },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "priority" })]),
    );
  });

  it("無効な assigneeId は 400 Bad Request", async () => {
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

    const response = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      {
        title: "invalid assignee",
        assigneeId: "not-a-uuid",
      },
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

  it("空文字の assigneeId は 400 Bad Request", async () => {
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

    const response = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      {
        title: "empty assignee",
        assigneeId: "",
      },
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

  it("Viewer は作成できず 403 Forbidden", async () => {
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

    const response = await createTicketRequest(
      app,
      viewerToken,
      organizationId,
      {
        title: "viewer ticket",
      },
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_FORBIDDEN");
  });

  it("組織に所属していないユーザーは 403 Forbidden", async () => {
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

    const response = await createTicketRequest(
      app,
      otherToken,
      organizationId,
      {
        title: "other ticket",
      },
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_FORBIDDEN");
  });

  it("存在しない組織には 403 Forbidden", async () => {
    const { accessToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );

    const response = await createTicketRequest(app, accessToken, randomUUID(), {
      title: "ghost org ticket",
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_FORBIDDEN");
  });

  it("他組織メンバーを assigneeId に指定すると 400 Bad Request", async () => {
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

    const { userId: otherMemberId } = await registerUser(
      app,
      uniqueEmail("other-member"),
      "password123",
    );
    const otherOrganizationId = await createOrganization(
      app,
      ownerToken,
      "Other Inc.",
      "other-inc",
    );
    await addMember(otherOrganizationId, otherMemberId, "member");

    const response = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      {
        title: "bad assignee",
        assigneeId: otherMemberId,
      },
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

  it("未認証の場合は 401 Unauthorized", async () => {
    const response = await app.request(
      "/api/organizations/550e8400-e29b-41d4-a716-446655440000/tickets",
      {
        method: "POST",
        body: JSON.stringify({ title: "unauthorized" }),
        headers: { "Content-Type": "application/json" },
      },
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_UNAUTHORIZED");
  });

  it("無効な organizationId の場合は 400 Bad Request", async () => {
    const { accessToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );

    const response = await app.request(
      "/api/organizations/invalid-id/tickets",
      {
        method: "POST",
        body: JSON.stringify({ title: "invalid org" }),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
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

  it("チケット作成時に監査ログが記録される", async () => {
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

    const response = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      {
        title: "audited ticket",
        priority: "high",
      },
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);

    const logs = await prisma.auditLog.findMany({
      where: {
        organizationId,
        entityType: "ticket",
        entityId: body.data.id,
        action: "create",
      },
    });
    expect(logs).toHaveLength(1);
    const log = logs[0];
    expect(log).not.toBeUndefined();
    expect(log?.actorId).toBe(body.data.createdBy);
    expect(log?.newValues).toMatchObject({
      title: "audited ticket",
      priority: "high",
      status: "open",
    });
  });
});

describe("GET /api/organizations/:organizationId/tickets (tickets.list)", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    await cleanAll();
    app = createApp();
  });
  afterAll(async () => {
    await cleanAll();
  });

  async function listTicketsRequest(
    accessToken: string,
    organizationId: string,
    query = "",
  ): Promise<Response> {
    const url = `/api/organizations/${organizationId}/tickets${query}`;
    return app.request(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  it("組織のチケット一覧を取得できる", async () => {
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
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "first ticket",
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "second ticket",
    });

    const response = await listTicketsRequest(ownerToken, organizationId);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(2);
    expect(body.meta).toEqual({
      page: 1,
      perPage: 20,
      total: 2,
      totalPages: 1,
    });
  });

  it("member ロールでもチケット一覧を閲覧できる", async () => {
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
      title: "member view ticket",
    });

    const response = await listTicketsRequest(memberToken, organizationId);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(1);
  });

  it("admin ロールでもチケット一覧を閲覧できる", async () => {
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

    const response = await listTicketsRequest(adminToken, organizationId);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  it("viewer ロールでもチケット一覧を閲覧できる", async () => {
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

    const response = await listTicketsRequest(viewerToken, organizationId);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  it("他組織のチケットは含まれない", async () => {
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

    const response = await listTicketsRequest(ownerAToken, organizationAId);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(1);
    expect(body.data.tickets[0]?.title).toBe("org a ticket");
  });

  it("ページネーションパラメータで取得範囲を制限できる", async () => {
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
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "ticket 1",
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "ticket 2",
    });

    const response = await listTicketsRequest(
      ownerToken,
      organizationId,
      "?page=1&perPage=1",
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(1);
    expect(body.meta).toEqual({
      page: 1,
      perPage: 1,
      total: 2,
      totalPages: 2,
    });
  });

  it("page=2 で2件目のチケットを取得できる", async () => {
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
    const ticket1Response = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      {
        title: "ticket 1",
      },
    );
    const ticket1Body = await ticket1Response.json();
    const ticket2Response = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      {
        title: "ticket 2",
      },
    );
    const ticket2Body = await ticket2Response.json();
    await prisma.ticket.update({
      where: { id: ticket2Body.data.id },
      data: {
        updatedAt: new Date("2099-01-01T00:00:00.000Z"),
      },
    });

    const response = await listTicketsRequest(
      ownerToken,
      organizationId,
      "?page=2&perPage=1",
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(1);
    expect(body.data.tickets[0]?.title).toBe("ticket 1");
    expect(body.data.tickets[0]?.id).toBe(ticket1Body.data.id);
    expect(body.meta).toMatchObject({
      page: 2,
      perPage: 1,
      total: 2,
      totalPages: 2,
    });
  });

  it("チケットが0件の場合は空配列と totalPages:1 を返す", async () => {
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

    const response = await listTicketsRequest(ownerToken, organizationId);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toEqual([]);
    expect(body.meta).toEqual({
      page: 1,
      perPage: 20,
      total: 0,
      totalPages: 1,
    });
  });

  it("更新日時の降順でソートされる", async () => {
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
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "older",
    });
    const newerResponse = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      {
        title: "newer",
      },
    );
    const newerBody = await newerResponse.json();
    await prisma.ticket.update({
      where: { id: newerBody.data.id },
      data: {
        updatedAt: new Date("2099-01-01T00:00:00.000Z"),
      },
    });

    const response = await listTicketsRequest(ownerToken, organizationId);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets[0]?.title).toBe("newer");
    expect(body.data.tickets[1]?.title).toBe("older");
  });

  it("一覧レスポンスに status、priority、assignee、updatedAt を含める", async () => {
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
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "fields ticket",
      priority: "high",
    });

    const response = await listTicketsRequest(ownerToken, organizationId);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    const ticket = body.data.tickets[0];
    expect(ticket).toMatchObject({
      status: "open",
      priority: "high",
      assignee: null,
    });
    expect(ticket.updatedAt).toEqual(expect.any(String));
    expect(ticket.description).toBeUndefined();
  });

  it("担当者を設定すると assignee オブジェクトを返す", async () => {
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
    await createTicketRequest(app, memberToken, organizationId, {
      title: "assigned ticket",
      assigneeId: memberUserId,
    });

    const response = await listTicketsRequest(ownerToken, organizationId);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    const ticket = body.data.tickets[0];
    expect(ticket.assignee).toEqual({
      id: memberUserId,
      name: null,
    });
  });

  it("組織に所属していないユーザーは 403 Forbidden", async () => {
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

    const response = await listTicketsRequest(otherToken, organizationId);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_FORBIDDEN");
  });

  it("未認証の場合は 401 Unauthorized", async () => {
    const response = await app.request(
      "/api/organizations/550e8400-e29b-41d4-a716-446655440000/tickets",
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_UNAUTHORIZED");
  });

  it("無効な organizationId の場合は 400 Bad Request", async () => {
    const { accessToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );

    const response = await listTicketsRequest(accessToken, "invalid-id");

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it.each([
    { query: "?page=0", description: "page=0" },
    { query: "?perPage=0", description: "perPage=0" },
    { query: "?perPage=101", description: "perPage=101" },
    { query: "?page=abc", description: "page=abc" },
    { query: "?perPage=abc", description: "perPage=abc" },
    { query: "?page=10001&perPage=1", description: "page over MAX_SKIP" },
  ])(
    "無効なページネーションパラメータ ($description) の場合は 400 Bad Request",
    async ({ query }) => {
      const { accessToken } = await registerUser(
        app,
        uniqueEmail("owner"),
        "password123",
      );
      const organizationId = await createOrganization(
        app,
        accessToken,
        "Acme Inc.",
        "acme-inc",
      );

      const response = await listTicketsRequest(
        accessToken,
        organizationId,
        query,
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    },
  );
});

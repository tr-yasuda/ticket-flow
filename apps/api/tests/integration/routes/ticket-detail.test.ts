import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

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
  const { prisma } = await import("../../../src/lib/prisma.js");
  await prisma.organizationMember.create({
    data: { organizationId, userId, role },
  });
}

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

async function getTicket(
  app: ReturnType<typeof createApp>,
  token: string,
  orgId: string,
  ticketId: string,
): Promise<Response> {
  return app.request(`/api/organizations/${orgId}/tickets/${ticketId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
}

describe("GET /api/organizations/:organizationId/tickets/:ticketId (ticket.get)", () => {
  let app: ReturnType<typeof createApp>;
  beforeEach(async () => {
    await cleanAll();
    app = createApp();
  });
  afterAll(async () => {
    await cleanAll();
  });

  it("Owner がチケット詳細を取得できる", async () => {
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
      "新規チケット",
      { description: "詳細説明", assigneeId: ownerUserId },
    );

    const response = await getTicket(app, ownerToken, organizationId, ticketId);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(ticketId);
    expect(body.data.title).toBe("新規チケット");
    expect(body.data.description).toBe("詳細説明");
    expect(body.data.status).toBe("open");
    expect(body.data.priority).toBe("medium");
    expect(body.data.organizationId).toBe(organizationId);
    expect(body.data.createdBy).toEqual(expect.any(String));
    expect(body.data.assigneeId).toBe(ownerUserId);
    expect(body.data.createdAt).toEqual(expect.any(String));
    expect(body.data.updatedAt).toEqual(expect.any(String));
    expect(body.data.commentCount).toBe(0);
  });

  it("Member がチケット詳細を取得できる", async () => {
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
      "member ticket",
    );

    const response = await getTicket(
      app,
      memberToken,
      organizationId,
      ticketId,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(ticketId);
  });

  it("Admin がチケット詳細を取得できる", async () => {
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
      "admin ticket",
    );

    const response = await getTicket(app, adminToken, organizationId, ticketId);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(ticketId);
  });

  it("Viewer がチケット詳細を取得できる", async () => {
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
      "viewer ticket",
    );

    const response = await getTicket(
      app,
      viewerToken,
      organizationId,
      ticketId,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(ticketId);
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

    const response = await getTicket(
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

    const response = await getTicket(
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
      "/api/organizations/550e8400-e29b-41d4-a716-446655440000/tickets/550e8400-e29b-41d4-a716-446655440001",
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

    const response = await getTicket(app, otherToken, organizationId, ticketId);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_FORBIDDEN");
  });

  it("大文字の ticketId でもチケット詳細を取得できる", async () => {
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

    const response = await getTicket(
      app,
      ownerToken,
      organizationId,
      upperTicketId,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(ticketId);
  });

  it("無効な organizationId の場合は 400 Bad Request", async () => {
    const { accessToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );

    const response = await app.request(
      "/api/organizations/invalid-id/tickets/550e8400-e29b-41d4-a716-446655440001",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
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

    const response = await getTicket(
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
});

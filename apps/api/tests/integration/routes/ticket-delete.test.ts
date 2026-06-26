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

async function deleteTicketRequest(
  app: ReturnType<typeof createApp>,
  accessToken: string,
  organizationId: string,
  ticketId: string,
): Promise<Response> {
  return app.request(
    `/api/organizations/${organizationId}/tickets/${ticketId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
}

describe("DELETE /api/organizations/:organizationId/tickets/:ticketId (ticket.delete)", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    await cleanAll();
    app = createApp();
  });
  afterAll(async () => {
    await cleanAll();
  });

  it("Owner がチケットを削除できる", async () => {
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
    const createResponse = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      { title: "削除対象チケット" },
    );
    const createdBody = await createResponse.json();
    const ticketId = createdBody.data.id as string;

    const response = await deleteTicketRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
    );

    expect(response.status).toBe(204);
    const deletedTicket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    expect(deletedTicket).not.toBeNull();
    expect(deletedTicket?.deletedAt).not.toBeNull();
  });

  it("Admin がチケットを削除できる", async () => {
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
    const createResponse = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      { title: "削除対象チケット" },
    );
    const createdBody = await createResponse.json();
    const ticketId = createdBody.data.id as string;

    const response = await deleteTicketRequest(
      app,
      adminToken,
      organizationId,
      ticketId,
    );

    expect(response.status).toBe(204);
  });

  it("Member が削除すると 403 Forbidden", async () => {
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
    const createResponse = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      { title: "削除対象チケット" },
    );
    const createdBody = await createResponse.json();
    const ticketId = createdBody.data.id as string;

    const response = await deleteTicketRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_FORBIDDEN");
  });

  it("Viewer が削除すると 403 Forbidden", async () => {
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
    const createResponse = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      { title: "削除対象チケット" },
    );
    const createdBody = await createResponse.json();
    const ticketId = createdBody.data.id as string;

    const response = await deleteTicketRequest(
      app,
      viewerToken,
      organizationId,
      ticketId,
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_FORBIDDEN");
  });

  it("他組織のチケットは 404 Not Found", async () => {
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
    const otherOrganizationId = await createOrganization(
      app,
      ownerToken,
      "Other Inc.",
      "other-inc",
    );
    const createResponse = await createTicketRequest(
      app,
      ownerToken,
      otherOrganizationId,
      { title: "他組織チケット" },
    );
    const createdBody = await createResponse.json();
    const ticketId = createdBody.data.id as string;

    const response = await deleteTicketRequest(
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

    const response = await deleteTicketRequest(
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

  it("削除済みチケットへの再削除は 404 Not Found", async () => {
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
    const createResponse = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      { title: "削除対象チケット" },
    );
    const createdBody = await createResponse.json();
    const ticketId = createdBody.data.id as string;

    await deleteTicketRequest(app, ownerToken, organizationId, ticketId);
    const response = await deleteTicketRequest(
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

  it("削除後の一覧と取得で対象外になる", async () => {
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
    const createResponse = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      { title: "削除対象チケット" },
    );
    const createdBody = await createResponse.json();
    const ticketId = createdBody.data.id as string;

    await deleteTicketRequest(app, ownerToken, organizationId, ticketId);

    const listResponse = await app.request(
      `/api/organizations/${organizationId}/tickets`,
      {
        headers: { Authorization: `Bearer ${ownerToken}` },
      },
    );
    const listBody = await listResponse.json();
    expect(listBody.data.tickets).toHaveLength(0);

    const getResponse = await app.request(
      `/api/organizations/${organizationId}/tickets/${ticketId}`,
      {
        headers: { Authorization: `Bearer ${ownerToken}` },
      },
    );
    expect(getResponse.status).toBe(404);
  });

  it("削除時に監査ログが記録される", async () => {
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
    const createResponse = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      { title: "削除対象チケット", priority: "high" },
    );
    const createdBody = await createResponse.json();
    const ticketId = createdBody.data.id as string;

    await deleteTicketRequest(app, ownerToken, organizationId, ticketId);

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        organizationId,
        entityType: "ticket",
        entityId: ticketId,
        action: "delete",
      },
      orderBy: { createdAt: "desc" },
    });
    expect(auditLog).not.toBeNull();
    expect(auditLog?.actorId).toBe(ownerUserId);
    expect(auditLog?.oldValues).toMatchObject({
      title: "削除対象チケット",
      priority: "high",
    });
    expect(auditLog?.newValues).toMatchObject({
      deletedAt: expect.any(String),
    });
  });

  it("大文字 UUID の ticketId でも削除できる", async () => {
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
    const createResponse = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      { title: "削除対象チケット" },
    );
    const createdBody = await createResponse.json();
    const ticketId = (createdBody.data.id as string).toUpperCase();

    const response = await deleteTicketRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
    );

    expect(response.status).toBe(204);
  });
});

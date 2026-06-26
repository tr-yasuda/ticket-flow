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

async function createCommentRequest(
  app: ReturnType<typeof createApp>,
  accessToken: string,
  organizationId: string,
  ticketId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return app.request(
    `/api/organizations/${organizationId}/tickets/${ticketId}/comments`,
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
}

describe("POST /api/organizations/:organizationId/tickets/:ticketId/comments (comment.create)", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    await cleanAll();
    app = createApp();
  });
  afterAll(async () => {
    await cleanAll();
  });

  it("Member が有効な内容でコメントを投稿できる", async () => {
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
    const ticketResponse = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      { title: "target ticket" },
    );
    const ticketBody = await ticketResponse.json();
    const ticketId = ticketBody.data.id;

    const response = await createCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      { content: "これはコメントです" },
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.comment.id).toEqual(expect.any(String));
    expect(body.data.comment.content).toBe("これはコメントです");
    expect(body.data.comment.ticketId).toBe(ticketId);
    expect(body.data.comment.organizationId).toBe(organizationId);
  });

  it("コメントの author_id が現在のユーザーになる", async () => {
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
    const ticketResponse = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      { title: "target ticket" },
    );
    const ticketBody = await ticketResponse.json();
    const ticketId = ticketBody.data.id;

    const response = await createCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      { content: "author test" },
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.comment.authorId).toBe(memberUserId);

    const stored = await prisma.comment.findUnique({
      where: { id: body.data.comment.id },
    });
    expect(stored).not.toBeNull();
    expect(stored?.authorId).toBe(memberUserId);
  });

  it("空のコメント内容は 400 Bad Request", async () => {
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
    const ticketResponse = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      { title: "target ticket" },
    );
    const ticketBody = await ticketResponse.json();

    const response = await createCommentRequest(
      app,
      ownerToken,
      organizationId,
      ticketBody.data.id,
      { content: "   " },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "content" })]),
    );
  });

  it("content を省略すると 400 Bad Request", async () => {
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
    const ticketResponse = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      { title: "target ticket" },
    );
    const ticketBody = await ticketResponse.json();

    const response = await createCommentRequest(
      app,
      ownerToken,
      organizationId,
      ticketBody.data.id,
      {},
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "content" })]),
    );
  });

  it("他組織のチケットには 404 Not Found", async () => {
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
    const otherOrganizationId = await createOrganization(
      app,
      otherToken,
      "Other Inc.",
      "other-inc",
    );
    const ticketResponse = await createTicketRequest(
      app,
      otherToken,
      otherOrganizationId,
      { title: "other org ticket" },
    );
    const ticketBody = await ticketResponse.json();

    const response = await createCommentRequest(
      app,
      ownerToken,
      organizationId,
      ticketBody.data.id,
      { content: "wrong org" },
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("存在しないチケットには 404 Not Found", async () => {
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

    const response = await createCommentRequest(
      app,
      ownerToken,
      organizationId,
      "550e8400-e29b-41d4-a716-446655440000",
      { content: "ghost ticket" },
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("Viewer ロールからの実行は 403 Forbidden", async () => {
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
    const ticketResponse = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      { title: "target ticket" },
    );
    const ticketBody = await ticketResponse.json();

    const response = await createCommentRequest(
      app,
      viewerToken,
      organizationId,
      ticketBody.data.id,
      { content: "viewer comment" },
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
    const ticketResponse = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      { title: "target ticket" },
    );
    const ticketBody = await ticketResponse.json();

    const response = await createCommentRequest(
      app,
      otherToken,
      organizationId,
      ticketBody.data.id,
      { content: "outsider comment" },
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_FORBIDDEN");
  });

  it("未認証の場合は 401 Unauthorized", async () => {
    const response = await app.request(
      "/api/organizations/550e8400-e29b-41d4-a716-446655440000/tickets/550e8400-e29b-41d4-a716-446655440000/comments",
      {
        method: "POST",
        body: JSON.stringify({ content: "unauthorized" }),
        headers: { "Content-Type": "application/json" },
      },
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_UNAUTHORIZED");
  });
});

import { MAX_COMMENT_CONTENT_LENGTH } from "@ticket-flow/shared";
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

async function setupOrganizationWithTicket(
  app: ReturnType<typeof createApp>,
  memberRole?: "admin" | "member" | "viewer",
): Promise<{
  ownerToken: string;
  memberToken: string;
  memberUserId: string;
  organizationId: string;
  ticketId: string;
}> {
  const { accessToken: ownerToken } = await registerUser(
    app,
    uniqueEmail("owner"),
    "password123",
  );
  const { userId: memberUserId, accessToken: memberToken } = await registerUser(
    app,
    uniqueEmail("member"),
    "password123",
  );
  const organizationId = await createOrganization(
    app,
    ownerToken,
    "Acme Inc.",
    `acme-${crypto.randomUUID()}`,
  );
  if (memberRole !== undefined) {
    await addMember(organizationId, memberUserId, memberRole);
  }
  const ticketResponse = await createTicketRequest(
    app,
    ownerToken,
    organizationId,
    { title: "target ticket" },
  );
  const ticketBody = await ticketResponse.json();
  return {
    ownerToken,
    memberToken,
    memberUserId,
    organizationId,
    ticketId: ticketBody.data.id,
  };
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
    const { memberToken, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "member");

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
    expect(body.data.id).toEqual(expect.any(String));
    expect(body.data.content).toBe("これはコメントです");
    expect(body.data.ticketId).toBe(ticketId);
    expect(body.data.organizationId).toBe(organizationId);
  });

  it("Owner がコメントを投稿できる", async () => {
    const { ownerToken, organizationId, ticketId } =
      await setupOrganizationWithTicket(app);

    const response = await createCommentRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
      { content: "owner comment" },
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.content).toBe("owner comment");
  });

  it("Admin がコメントを投稿できる", async () => {
    const { memberToken, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "admin");

    const response = await createCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      { content: "admin comment" },
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.content).toBe("admin comment");
  });

  it("コメントの author_id が現在のユーザーになる", async () => {
    const { memberToken, memberUserId, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "member");

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
    expect(body.data.authorId).toBe(memberUserId);

    const stored = await prisma.comment.findUnique({
      where: { id: body.data.id },
    });
    expect(stored).not.toBeNull();
    expect(stored?.authorId).toBe(memberUserId);
  });

  it("前後の空白はトリムされる", async () => {
    const { memberToken, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "member");

    const response = await createCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      { content: "  trimmed comment  " },
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.content).toBe("trimmed comment");
  });

  it(`${MAX_COMMENT_CONTENT_LENGTH}文字のコメントは投稿できる`, async () => {
    const { memberToken, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "member");

    const response = await createCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      { content: "a".repeat(MAX_COMMENT_CONTENT_LENGTH) },
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.content).toHaveLength(MAX_COMMENT_CONTENT_LENGTH);
  });

  it(`${MAX_COMMENT_CONTENT_LENGTH + 1}文字のコメントは 400 Bad Request`, async () => {
    const { memberToken, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "member");

    const response = await createCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      { content: "a".repeat(MAX_COMMENT_CONTENT_LENGTH + 1) },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "content" })]),
    );
  });

  it("空のコメント内容は 400 Bad Request", async () => {
    const { ownerToken, organizationId, ticketId } =
      await setupOrganizationWithTicket(app);

    const response = await createCommentRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
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
    const { ownerToken, organizationId, ticketId } =
      await setupOrganizationWithTicket(app);

    const response = await createCommentRequest(
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
      expect.arrayContaining([expect.objectContaining({ field: "content" })]),
    );
  });

  it("他組織のチケットには 404 Not Found", async () => {
    const { ownerToken, organizationId } =
      await setupOrganizationWithTicket(app);
    const { accessToken: otherToken } = await registerUser(
      app,
      uniqueEmail("other"),
      "password123",
    );
    const otherOrganizationId = await createOrganization(
      app,
      otherToken,
      "Other Inc.",
      `other-${crypto.randomUUID()}`,
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
    const { ownerToken, organizationId } =
      await setupOrganizationWithTicket(app);

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

  it("無効なチケット ID 形式は 400 Bad Request", async () => {
    const { ownerToken, organizationId } =
      await setupOrganizationWithTicket(app);

    const response = await createCommentRequest(
      app,
      ownerToken,
      organizationId,
      "not-a-uuid",
      { content: "invalid ticket id" },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "ticketId" })]),
    );
  });

  it("Viewer ロールからの実行は 403 Forbidden", async () => {
    const { memberToken, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "viewer");

    const response = await createCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      { content: "viewer comment" },
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_FORBIDDEN");
  });

  it("組織に所属していないユーザーは 403 Forbidden", async () => {
    const { organizationId, ticketId } = await setupOrganizationWithTicket(app);
    const { accessToken: otherToken } = await registerUser(
      app,
      uniqueEmail("other"),
      "password123",
    );

    const response = await createCommentRequest(
      app,
      otherToken,
      organizationId,
      ticketId,
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

  it("コメント作成時に監査ログが保存される", async () => {
    const { memberToken, memberUserId, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "member");

    const response = await createCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      { content: "auditable comment" },
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    const commentId = body.data.id;

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        organizationId,
        actorId: memberUserId,
        entityType: "comment",
        entityId: commentId,
        action: "create",
      },
    });
    expect(auditLog).not.toBeNull();
    expect(
      (auditLog!.newValues as { content?: string; ticketId?: string }).content,
    ).toBe("auditable comment");
    expect(
      (auditLog!.newValues as { content?: string; ticketId?: string }).ticketId,
    ).toBe(ticketId);
  });
});

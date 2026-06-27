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

async function listCommentsRequest(
  app: ReturnType<typeof createApp>,
  accessToken: string | undefined,
  organizationId: string,
  ticketId: string,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (accessToken !== undefined) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return app.request(
    `/api/organizations/${organizationId}/tickets/${ticketId}/comments`,
    {
      method: "GET",
      headers,
    },
  );
}

async function updateCommentRequest(
  app: ReturnType<typeof createApp>,
  accessToken: string,
  organizationId: string,
  ticketId: string,
  commentId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return app.request(
    `/api/organizations/${organizationId}/tickets/${ticketId}/comments/${commentId}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
}

async function deleteCommentRequest(
  app: ReturnType<typeof createApp>,
  accessToken: string,
  organizationId: string,
  ticketId: string,
  commentId: string,
): Promise<Response> {
  return app.request(
    `/api/organizations/${organizationId}/tickets/${ticketId}/comments/${commentId}`,
    {
      method: "DELETE",
      headers: {
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
  memberEmail: string;
  organizationId: string;
  ticketId: string;
}> {
  const { accessToken: ownerToken } = await registerUser(
    app,
    uniqueEmail("owner"),
    "password123",
  );
  const memberEmail = uniqueEmail("member");
  const { userId: memberUserId, accessToken: memberToken } = await registerUser(
    app,
    memberEmail,
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
    memberEmail,
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
    expect(body.data.isEdited).toBe(false);
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

  it("コメントの author.id が現在のユーザーになる", async () => {
    const { memberToken, memberUserId, memberEmail, organizationId, ticketId } =
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
    expect(body.data.author.id).toBe(memberUserId);
    expect(body.data.author.email).toBe(memberEmail);
    expect(body.data.author.name).toBeNull();

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

describe("GET /api/organizations/:organizationId/tickets/:ticketId/comments (comment.list)", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    await cleanAll();
    app = createApp();
  });
  afterAll(async () => {
    await cleanAll();
  });

  it("Member がコメント一覧を取得できる", async () => {
    const { memberToken, memberUserId, memberEmail, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "member");

    await createCommentRequest(app, memberToken, organizationId, ticketId, {
      content: "comment by member",
    });

    const response = await listCommentsRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.meta.total).toBe(1);
    expect(body.data.comments).toHaveLength(1);
    expect(body.data.comments[0]?.content).toBe("comment by member");
    expect(body.data.comments[0]?.author.id).toBe(memberUserId);
    expect(body.data.comments[0]?.author.email).toBe(memberEmail);
    expect(body.data.comments[0]?.author.name).toBeNull();
    expect(body.data.comments[0]?.isEdited).toBe(false);
    expect(typeof body.data.comments[0]?.createdAt).toBe("string");
  });

  it("コメントが 0 件の場合は空配列を返す", async () => {
    const { memberToken, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "member");

    const response = await listCommentsRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.meta.total).toBe(0);
    expect(body.data.comments).toHaveLength(0);
    expect(body.meta.page).toBe(1);
    expect(body.meta.perPage).toBe(20);
    expect(body.meta.totalPages).toBe(1);
  });

  it("Admin がコメント一覧を取得できる", async () => {
    const { memberToken, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "admin");

    await createCommentRequest(app, memberToken, organizationId, ticketId, {
      content: "comment by admin",
    });

    const response = await listCommentsRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.comments).toHaveLength(1);
    expect(body.data.comments[0]?.content).toBe("comment by admin");
  });

  it("Viewer がコメント一覧を取得できる", async () => {
    const { ownerToken, memberToken, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "viewer");

    await createCommentRequest(app, ownerToken, organizationId, ticketId, {
      content: "comment by owner",
    });

    const response = await listCommentsRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.comments).toHaveLength(1);
    expect(body.data.comments[0]?.content).toBe("comment by owner");
  });

  it("コメントが作成日時順に返される", async () => {
    const { memberToken, memberUserId, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "member");

    await prisma.comment.createMany({
      data: [
        {
          id: crypto.randomUUID(),
          ticketId,
          organizationId,
          authorId: memberUserId,
          content: "older comment",
          createdAt: new Date("2026-06-20T00:00:00.000Z"),
          updatedAt: new Date("2026-06-20T00:00:00.000Z"),
        },
        {
          id: crypto.randomUUID(),
          ticketId,
          organizationId,
          authorId: memberUserId,
          content: "newer comment",
          createdAt: new Date("2026-06-20T00:00:01.000Z"),
          updatedAt: new Date("2026-06-20T00:00:01.000Z"),
        },
      ],
    });

    const response = await listCommentsRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.comments).toHaveLength(2);
    expect(body.data.comments[0]?.content).toBe("newer comment");
    expect(body.data.comments[1]?.content).toBe("older comment");
  });

  it("他組織のチケットは 404 Not Found", async () => {
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

    const response = await listCommentsRequest(
      app,
      ownerToken,
      organizationId,
      ticketBody.data.id,
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("存在しないチケットは 404 Not Found", async () => {
    const { ownerToken, organizationId } =
      await setupOrganizationWithTicket(app);

    const response = await listCommentsRequest(
      app,
      ownerToken,
      organizationId,
      "550e8400-e29b-41d4-a716-446655440000",
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("無効なチケット ID 形式は 400 Bad Request", async () => {
    const { ownerToken, organizationId } =
      await setupOrganizationWithTicket(app);

    const response = await listCommentsRequest(
      app,
      ownerToken,
      organizationId,
      "not-a-uuid",
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "ticketId" })]),
    );
  });

  it("組織に所属していないユーザーは 403 Forbidden", async () => {
    const { organizationId, ticketId } = await setupOrganizationWithTicket(app);
    const { accessToken: otherToken } = await registerUser(
      app,
      uniqueEmail("other"),
      "password123",
    );

    const response = await listCommentsRequest(
      app,
      otherToken,
      organizationId,
      ticketId,
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_FORBIDDEN");
  });

  it("論理削除済みのチケットは 404 Not Found", async () => {
    const { ownerToken, organizationId, ticketId } =
      await setupOrganizationWithTicket(app);

    await prisma.ticket.updateMany({
      where: { id: ticketId, organizationId },
      data: { deletedAt: new Date() },
    });

    const response = await listCommentsRequest(
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

  it("ページネーションパラメータで件数を制御できる", async () => {
    const { memberToken, memberUserId, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "member");

    await prisma.comment.createMany({
      data: [
        {
          id: crypto.randomUUID(),
          ticketId,
          organizationId,
          authorId: memberUserId,
          content: "older",
          createdAt: new Date("2026-06-20T00:00:00.000Z"),
          updatedAt: new Date("2026-06-20T00:00:00.000Z"),
        },
        {
          id: crypto.randomUUID(),
          ticketId,
          organizationId,
          authorId: memberUserId,
          content: "newer",
          createdAt: new Date("2026-06-20T00:00:01.000Z"),
          updatedAt: new Date("2026-06-20T00:00:01.000Z"),
        },
      ],
    });

    const response = await app.request(
      `/api/organizations/${organizationId}/tickets/${ticketId}/comments?page=1&perPage=1`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${memberToken}` },
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.comments).toHaveLength(1);
    expect(body.data.comments[0]?.content).toBe("newer");
    expect(body.meta.total).toBe(2);
    expect(body.meta.page).toBe(1);
    expect(body.meta.perPage).toBe(1);
    expect(body.meta.totalPages).toBe(2);
  });

  it("未認証の場合は 401 Unauthorized", async () => {
    const response = await listCommentsRequest(
      app,
      undefined,
      "550e8400-e29b-41d4-a716-446655440000",
      "550e8400-e29b-41d4-a716-446655440000",
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_UNAUTHORIZED");
  });
});

describe("PATCH /api/organizations/:organizationId/tickets/:ticketId/comments/:commentId (comment.update)", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    await cleanAll();
    app = createApp();
  });
  afterAll(async () => {
    await cleanAll();
  });

  it("Member が自分のコメントを編集できる", async () => {
    const { memberToken, memberUserId, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "member");
    const createResponse = await createCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      { content: "original comment" },
    );
    const createBody = await createResponse.json();
    const commentId = createBody.data.id;

    const response = await updateCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      commentId,
      { content: "updated comment" },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(commentId);
    expect(body.data.content).toBe("updated comment");
    expect(body.data.author.id).toBe(memberUserId);
  });

  it("Owner が自分のコメントを編集できる", async () => {
    const { ownerToken, organizationId, ticketId } =
      await setupOrganizationWithTicket(app);
    const createResponse = await createCommentRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
      { content: "owner comment" },
    );
    const createBody = await createResponse.json();

    const response = await updateCommentRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
      createBody.data.id,
      { content: "updated owner comment" },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.content).toBe("updated owner comment");
  });

  it("Admin が自分のコメントを編集できる", async () => {
    const { memberToken, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "admin");
    const createResponse = await createCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      { content: "admin comment" },
    );
    const createBody = await createResponse.json();

    const response = await updateCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      createBody.data.id,
      { content: "updated admin comment" },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.content).toBe("updated admin comment");
  });

  it("編集後に isEdited が true になる", async () => {
    const { memberToken, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "member");
    const createResponse = await createCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      { content: "original" },
    );
    const createBody = await createResponse.json();

    const response = await updateCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      createBody.data.id,
      { content: "updated" },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.isEdited).toBe(true);
  });

  it("前後の空白はトリムされる", async () => {
    const { memberToken, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "member");
    const createResponse = await createCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      { content: "original" },
    );
    const createBody = await createResponse.json();

    const response = await updateCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      createBody.data.id,
      { content: "  updated comment  " },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.content).toBe("updated comment");
  });

  it("空の内容は 400 Bad Request", async () => {
    const { memberToken, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "member");
    const createResponse = await createCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      { content: "original" },
    );
    const createBody = await createResponse.json();

    const response = await updateCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      createBody.data.id,
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

  it(`${MAX_COMMENT_CONTENT_LENGTH}文字のコメントは編集できる`, async () => {
    const { memberToken, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "member");
    const createResponse = await createCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      { content: "original" },
    );
    const createBody = await createResponse.json();

    const response = await updateCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      createBody.data.id,
      { content: "a".repeat(MAX_COMMENT_CONTENT_LENGTH) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.content).toHaveLength(MAX_COMMENT_CONTENT_LENGTH);
  });

  it(`${MAX_COMMENT_CONTENT_LENGTH + 1}文字のコメントは 400 Bad Request`, async () => {
    const { memberToken, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "member");
    const createResponse = await createCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      { content: "original" },
    );
    const createBody = await createResponse.json();

    const response = await updateCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      createBody.data.id,
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

  it("他のユーザーのコメントは 403 Forbidden", async () => {
    const { ownerToken, memberToken, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "member");
    const createResponse = await createCommentRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
      { content: "owner comment" },
    );
    const createBody = await createResponse.json();

    const response = await updateCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      createBody.data.id,
      { content: "modified by member" },
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_FORBIDDEN");
  });

  it("存在しないコメントは 404 Not Found", async () => {
    const { memberToken, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "member");

    const response = await updateCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      "550e8400-e29b-41d4-a716-446655440000",
      { content: "updated" },
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("別のチケットのコメントは 404 Not Found", async () => {
    const { ownerToken, memberToken, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "member");
    const otherTicketResponse = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      { title: "other ticket" },
    );
    const otherTicketBody = await otherTicketResponse.json();
    const createResponse = await createCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      { content: "comment on first ticket" },
    );
    const createBody = await createResponse.json();

    const response = await updateCommentRequest(
      app,
      memberToken,
      organizationId,
      otherTicketBody.data.id,
      createBody.data.id,
      { content: "updated" },
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("他組織のコメントは 404 Not Found", async () => {
    const { memberToken, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "member");
    const {
      ownerToken: otherOwnerToken,
      organizationId: otherOrganizationId,
      ticketId: otherTicketId,
    } = await setupOrganizationWithTicket(app);
    const createResponse = await createCommentRequest(
      app,
      otherOwnerToken,
      otherOrganizationId,
      otherTicketId,
      { content: "comment in other org" },
    );
    const createBody = await createResponse.json();

    const response = await updateCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      createBody.data.id,
      { content: "updated" },
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("無効なコメント ID 形式は 400 Bad Request", async () => {
    const { memberToken, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "member");

    const response = await updateCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      "not-a-uuid",
      { content: "updated" },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "commentId" })]),
    );
  });

  it("無効なチケット ID 形式は 400 Bad Request", async () => {
    const { memberToken, organizationId } = await setupOrganizationWithTicket(
      app,
      "member",
    );

    const response = await updateCommentRequest(
      app,
      memberToken,
      organizationId,
      "not-a-uuid",
      "550e8400-e29b-41d4-a716-446655440000",
      { content: "updated" },
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
    const {
      memberToken: viewerToken,
      organizationId,
      ticketId,
    } = await setupOrganizationWithTicket(app, "viewer");

    const response = await updateCommentRequest(
      app,
      viewerToken,
      organizationId,
      ticketId,
      "550e8400-e29b-41d4-a716-446655440000",
      { content: "updated" },
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_FORBIDDEN");
  });

  it("未認証の場合は 401 Unauthorized", async () => {
    const response = await app.request(
      "/api/organizations/550e8400-e29b-41d4-a716-446655440000/tickets/550e8400-e29b-41d4-a716-446655440000/comments/550e8400-e29b-41d4-a716-446655440000",
      {
        method: "PATCH",
        body: JSON.stringify({ content: "updated" }),
        headers: { "Content-Type": "application/json" },
      },
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_UNAUTHORIZED");
  });

  it("コメント編集時に監査ログが保存される", async () => {
    const { memberToken, memberUserId, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "member");
    const createResponse = await createCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      { content: "original" },
    );
    const createBody = await createResponse.json();
    const commentId = createBody.data.id;

    const response = await updateCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      commentId,
      { content: "updated" },
    );

    expect(response.status).toBe(200);
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        organizationId,
        actorId: memberUserId,
        entityType: "comment",
        entityId: commentId,
        action: "update",
      },
    });
    expect(auditLog).not.toBeNull();
    expect((auditLog!.oldValues as { content?: string }).content).toBe(
      "original",
    );
    expect((auditLog!.newValues as { content?: string }).content).toBe(
      "updated",
    );
  });
});

describe("DELETE /api/organizations/:organizationId/tickets/:ticketId/comments/:commentId (comment.delete)", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    await cleanAll();
    app = createApp();
  });
  afterAll(async () => {
    await cleanAll();
  });

  it("Member が自分のコメントを削除できる", async () => {
    const { memberToken, memberUserId, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "member");
    const createResponse = await createCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      { content: "delete me" },
    );
    const createBody = await createResponse.json();
    const commentId = createBody.data.id;

    const response = await deleteCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      commentId,
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");

    const stored = await prisma.comment.findUnique({
      where: { id: commentId },
    });
    expect(stored).not.toBeNull();
    expect(stored?.authorId).toBe(memberUserId);
    expect(stored?.deletedAt).not.toBeNull();
  });

  it("Owner が他ユーザーのコメントを削除できる", async () => {
    const { ownerToken, memberToken, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "member");
    const createResponse = await createCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      { content: "delete by owner" },
    );
    const createBody = await createResponse.json();

    const response = await deleteCommentRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
      createBody.data.id,
    );

    expect(response.status).toBe(204);
  });

  it("Admin が他ユーザーのコメントを削除できる", async () => {
    const { memberToken, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "member");
    const { accessToken: adminToken, userId: adminUserId } = await registerUser(
      app,
      uniqueEmail("admin"),
      "password123",
    );
    await addMember(organizationId, adminUserId, "admin");
    const createResponse = await createCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      { content: "delete by admin" },
    );
    const createBody = await createResponse.json();

    const response = await deleteCommentRequest(
      app,
      adminToken,
      organizationId,
      ticketId,
      createBody.data.id,
    );

    expect(response.status).toBe(204);
  });

  it("他のユーザーのコメントは Member では削除できず 403 Forbidden", async () => {
    const { ownerToken, memberToken, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "member");
    const createResponse = await createCommentRequest(
      app,
      ownerToken,
      organizationId,
      ticketId,
      { content: "owner comment" },
    );
    const createBody = await createResponse.json();

    const response = await deleteCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      createBody.data.id,
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_FORBIDDEN");

    const stored = await prisma.comment.findUnique({
      where: { id: createBody.data.id },
    });
    expect(stored?.deletedAt).toBeNull();
  });

  it("存在しないコメントは 404 Not Found", async () => {
    const { memberToken, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "member");

    const response = await deleteCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      "550e8400-e29b-41d4-a716-446655440000",
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("別のチケットのコメントは 404 Not Found", async () => {
    const { ownerToken, memberToken, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "member");
    const otherTicketResponse = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      { title: "other ticket" },
    );
    const otherTicketBody = await otherTicketResponse.json();
    const createResponse = await createCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      { content: "comment on first ticket" },
    );
    const createBody = await createResponse.json();

    const response = await deleteCommentRequest(
      app,
      memberToken,
      organizationId,
      otherTicketBody.data.id,
      createBody.data.id,
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("他組織のコメントは 404 Not Found", async () => {
    const { memberToken, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "member");
    const {
      ownerToken: otherOwnerToken,
      organizationId: otherOrganizationId,
      ticketId: otherTicketId,
    } = await setupOrganizationWithTicket(app);
    const createResponse = await createCommentRequest(
      app,
      otherOwnerToken,
      otherOrganizationId,
      otherTicketId,
      { content: "comment in other org" },
    );
    const createBody = await createResponse.json();

    const response = await deleteCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      createBody.data.id,
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("無効なコメント ID 形式は 400 Bad Request", async () => {
    const { memberToken, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "member");

    const response = await deleteCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      "not-a-uuid",
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "commentId" })]),
    );
  });

  it("無効なチケット ID 形式は 400 Bad Request", async () => {
    const { memberToken, organizationId } = await setupOrganizationWithTicket(
      app,
      "member",
    );

    const response = await deleteCommentRequest(
      app,
      memberToken,
      organizationId,
      "not-a-uuid",
      "550e8400-e29b-41d4-a716-446655440000",
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
    const {
      memberToken: viewerToken,
      organizationId,
      ticketId,
    } = await setupOrganizationWithTicket(app, "viewer");

    const response = await deleteCommentRequest(
      app,
      viewerToken,
      organizationId,
      ticketId,
      "550e8400-e29b-41d4-a716-446655440000",
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_FORBIDDEN");
  });

  it("未認証の場合は 401 Unauthorized", async () => {
    const response = await app.request(
      "/api/organizations/550e8400-e29b-41d4-a716-446655440000/tickets/550e8400-e29b-41d4-a716-446655440000/comments/550e8400-e29b-41d4-a716-446655440000",
      {
        method: "DELETE",
      },
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_UNAUTHORIZED");
  });

  it("コメント削除時に監査ログが保存される", async () => {
    const { memberToken, memberUserId, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "member");
    const createResponse = await createCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      { content: "to be deleted" },
    );
    const createBody = await createResponse.json();
    const commentId = createBody.data.id;

    const response = await deleteCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      commentId,
    );

    expect(response.status).toBe(204);
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        organizationId,
        actorId: memberUserId,
        entityType: "comment",
        entityId: commentId,
        action: "delete",
      },
    });
    expect(auditLog).not.toBeNull();
    expect((auditLog!.oldValues as { content?: string }).content).toBe(
      "to be deleted",
    );
    expect(
      (auditLog!.newValues as { deletedAt?: string }).deletedAt,
    ).toBeDefined();
  });

  it("削除済みのコメントを再削除すると 404 Not Found", async () => {
    const { memberToken, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "member");
    const createResponse = await createCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      { content: "already deleted" },
    );
    const createBody = await createResponse.json();
    const commentId = createBody.data.id;

    await deleteCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      commentId,
    );

    const response = await deleteCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      commentId,
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("削除後のコメントは一覧に含まれず total が減少する", async () => {
    const { memberToken, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "member");
    const createResponse = await createCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      { content: "will be hidden" },
    );
    const createBody = await createResponse.json();

    await deleteCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      createBody.data.id,
    );

    const response = await listCommentsRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.comments).toHaveLength(0);
    expect(body.meta.total).toBe(0);
  });

  it("削除済みのコメントを更新しようとすると 404 Not Found", async () => {
    const { memberToken, organizationId, ticketId } =
      await setupOrganizationWithTicket(app, "member");
    const createResponse = await createCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      { content: "original" },
    );
    const createBody = await createResponse.json();

    await deleteCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      createBody.data.id,
    );

    const response = await updateCommentRequest(
      app,
      memberToken,
      organizationId,
      ticketId,
      createBody.data.id,
      { content: "updated after delete" },
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

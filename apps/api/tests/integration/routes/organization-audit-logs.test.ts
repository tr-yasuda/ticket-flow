import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createAuditLog } from "../../../src/domain/audit-log.js";
import { saveAuditLog } from "../../../src/infrastructure/database/audit-log-repository.js";
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
  expect(res.status).toBe(201);
  const body = await res.json();
  return body.data.id as string;
}

async function updateTicket(
  app: ReturnType<typeof createApp>,
  token: string,
  orgId: string,
  ticketId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const res = await app.request(
    `/api/organizations/${orgId}/tickets/${ticketId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );
  expect(res.status).toBe(200);
}

async function createAuditLogAt(
  organizationId: string,
  actorId: string | null,
  createdAt: Date,
  overrides?: {
    action?: string;
    entityId?: string;
    newValues?: Record<string, unknown>;
    oldValues?: Record<string, unknown>;
  },
): Promise<void> {
  const auditLog = createAuditLog({
    organizationId,
    actorId,
    entityType: "ticket",
    entityId: overrides?.entityId ?? randomUUID(),
    action: overrides?.action ?? "manual",
    oldValues: overrides?.oldValues ?? null,
    newValues: overrides?.newValues ?? { note: "test" },
  });
  await saveAuditLog({ ...auditLog, createdAt });
}

async function getOrganizationAuditLogs(
  app: ReturnType<typeof createApp>,
  token: string,
  orgId: string,
  query?: { page?: number; perPage?: number },
): Promise<Response> {
  const searchParams = new URLSearchParams();
  if (query?.page !== undefined) {
    searchParams.set("page", String(query.page));
  }
  if (query?.perPage !== undefined) {
    searchParams.set("perPage", String(query.perPage));
  }
  const queryString = searchParams.toString();
  const path = `/api/organizations/${orgId}/audit-logs${queryString ? `?${queryString}` : ""}`;
  return app.request(path, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
}

describe("GET /api/organizations/:organizationId/audit-logs (audit-logs.list)", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    await cleanAll();
    app = createApp();
  });

  afterAll(async () => {
    await cleanAll();
    await prisma.$disconnect();
  });

  it("Owner が組織監査ログを取得できる", async () => {
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
    await createTicket(app, ownerToken, organizationId, "監査ログ確認");

    const response = await getOrganizationAuditLogs(
      app,
      ownerToken,
      organizationId,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.auditLogs).toEqual(expect.any(Array));
    expect(body.data.auditLogs).toHaveLength(1);
    expect(body.meta).toEqual({
      page: 1,
      perPage: 20,
      total: 1,
      totalPages: 1,
    });
  });

  it("Admin が組織監査ログを取得できる", async () => {
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
    await createTicket(app, ownerToken, organizationId, "admin 閲覧");

    const response = await getOrganizationAuditLogs(
      app,
      adminToken,
      organizationId,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.auditLogs).toHaveLength(1);
  });

  it("Member が実行すると 403 Forbidden", async () => {
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

    const response = await getOrganizationAuditLogs(
      app,
      memberToken,
      organizationId,
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_FORBIDDEN");
  });

  it("Viewer が実行すると 403 Forbidden", async () => {
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

    const response = await getOrganizationAuditLogs(
      app,
      viewerToken,
      organizationId,
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

    const response = await getOrganizationAuditLogs(
      app,
      otherToken,
      organizationId,
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_FORBIDDEN");
  });

  it("存在しない organizationId の場合は 403 Forbidden", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    await createOrganization(app, ownerToken, "Acme Inc.", "acme-inc");

    const response = await getOrganizationAuditLogs(
      app,
      ownerToken,
      "550e8400-e29b-41d4-a716-446655440999",
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_FORBIDDEN");
  });

  it("未認証の場合は 401 Unauthorized", async () => {
    const response = await app.request(
      "/api/organizations/550e8400-e29b-41d4-a716-446655440000/audit-logs",
      { method: "GET" },
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_UNAUTHORIZED");
  });

  it("監査ログが時系列順に返される", async () => {
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
    await createAuditLogAt(organizationId, null, new Date(now - 2000), {
      action: "oldest",
    });
    await createAuditLogAt(organizationId, null, new Date(now - 1000), {
      action: "middle",
    });
    await createAuditLogAt(organizationId, null, new Date(now), {
      action: "newest",
    });

    const response = await getOrganizationAuditLogs(
      app,
      ownerToken,
      organizationId,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    const auditLogs = body.data.auditLogs as Array<{
      action: string;
      createdAt: string;
    }>;
    expect(auditLogs).toHaveLength(3);
    expect(auditLogs.map((log) => log.action)).toEqual([
      "newest",
      "middle",
      "oldest",
    ]);
    for (let i = 0; i < auditLogs.length - 1; i++) {
      expect(
        new Date(auditLogs[i]?.createdAt as string).getTime(),
      ).toBeGreaterThanOrEqual(
        new Date(auditLogs[i + 1]?.createdAt as string).getTime(),
      );
    }
  });

  it("各履歴に変更者、対象エンティティ、変更内容、変更日時が含まれる", async () => {
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
      "内容確認",
    );

    const response = await getOrganizationAuditLogs(
      app,
      ownerToken,
      organizationId,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    const auditLogs = body.data.auditLogs as Array<{
      id: string;
      actor: { id: string; name: string | null } | null;
      entityType: string;
      entityId: string;
      action: string;
      oldValues: Record<string, unknown> | null;
      newValues: Record<string, unknown> | null;
      createdAt: string;
    }>;
    expect(auditLogs).toHaveLength(1);
    const log = auditLogs[0];
    expect(log).toBeDefined();
    expect(log?.actor).not.toBeNull();
    expect(log?.actor?.id).toBe(ownerUserId);
    expect(log?.actor).not.toHaveProperty("email");
    expect(log?.entityType).toBe("ticket");
    expect(log?.entityId).toBe(ticketId);
    expect(log?.action).toBe("create");
    expect(log?.newValues).not.toBeNull();
    expect(log?.newValues).toHaveProperty("title");
    expect(log?.createdAt).toEqual(expect.any(String));
  });

  it("update アクションの oldValues と newValues が正しく返る", async () => {
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
      "更新前タイトル",
    );
    await updateTicket(app, ownerToken, organizationId, ticketId, {
      title: "更新後タイトル",
    });

    const response = await getOrganizationAuditLogs(
      app,
      ownerToken,
      organizationId,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    const auditLogs = body.data.auditLogs as Array<{
      action: string;
      oldValues: { title?: string } | null;
      newValues: { title?: string } | null;
    }>;
    const updateLog = auditLogs.find((item) => item.action === "update");
    expect(updateLog).toBeDefined();
    expect(updateLog?.oldValues?.title).toBe("更新前タイトル");
    expect(updateLog?.newValues?.title).toBe("更新後タイトル");
  });

  it("機密フィールドはレダクションされて返る", async () => {
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
    await createAuditLogAt(organizationId, null, new Date(), {
      action: "create",
      newValues: {
        title: "public",
        token: "secret-token-value",
        password: "secret-password",
      },
    });

    const response = await getOrganizationAuditLogs(
      app,
      ownerToken,
      organizationId,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    const auditLogs = body.data.auditLogs as Array<{
      newValues: Record<string, unknown>;
    }>;
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]?.newValues.title).toBe("public");
    expect(auditLogs[0]?.newValues.token).toBe("***");
    expect(auditLogs[0]?.newValues.password).toBe("***");
  });

  it("actor が null の履歴は actor: null で返る", async () => {
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
    await createAuditLogAt(organizationId, null, new Date(), {
      action: "manual",
      newValues: { note: "system operation" },
    });

    const response = await getOrganizationAuditLogs(
      app,
      ownerToken,
      organizationId,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    const auditLogs = body.data.auditLogs as Array<{
      action: string;
      actor: unknown;
    }>;
    const manualLog = auditLogs.find((item) => item.action === "manual");
    expect(manualLog).toBeDefined();
    expect(manualLog?.actor).toBeNull();
  });

  it("監査ログが 0 件の場合は空配列と totalPages=0 を返す", async () => {
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

    const response = await getOrganizationAuditLogs(
      app,
      ownerToken,
      organizationId,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.auditLogs).toEqual([]);
    expect(body.meta).toEqual({
      page: 1,
      perPage: 20,
      total: 0,
      totalPages: 0,
    });
  });

  it("ページネーションパラメータで件数を制御できる", async () => {
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
    await createAuditLogAt(organizationId, null, new Date(now - 2000), {
      action: "oldest",
    });
    await createAuditLogAt(organizationId, null, new Date(now - 1000), {
      action: "middle",
    });
    await createAuditLogAt(organizationId, null, new Date(now), {
      action: "newest",
    });

    const firstPage = await getOrganizationAuditLogs(
      app,
      ownerToken,
      organizationId,
      { page: 1, perPage: 2 },
    );
    expect(firstPage.status).toBe(200);
    const firstBody = await firstPage.json();
    expect(firstBody.data.auditLogs).toHaveLength(2);
    expect(firstBody.meta).toEqual({
      page: 1,
      perPage: 2,
      total: 3,
      totalPages: 2,
    });
    const firstPageActions = firstBody.data.auditLogs.map(
      (log: { action: string }) => log.action,
    );
    expect(firstPageActions).toEqual(["newest", "middle"]);

    const secondPage = await getOrganizationAuditLogs(
      app,
      ownerToken,
      organizationId,
      { page: 2, perPage: 2 },
    );
    expect(secondPage.status).toBe(200);
    const secondBody = await secondPage.json();
    expect(secondBody.data.auditLogs).toHaveLength(1);
    expect(secondBody.meta).toEqual({
      page: 2,
      perPage: 2,
      total: 3,
      totalPages: 2,
    });
    expect(secondBody.data.auditLogs[0]?.action).toBe("oldest");
  });

  it("無効な page パラメータは 400 Bad Request", async () => {
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

    const response = await getOrganizationAuditLogs(
      app,
      ownerToken,
      organizationId,
      { page: 0 },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("無効な perPage パラメータは 400 Bad Request", async () => {
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

    const zeroResponse = await getOrganizationAuditLogs(
      app,
      ownerToken,
      organizationId,
      { perPage: 0 },
    );
    expect(zeroResponse.status).toBe(400);

    const tooLargeResponse = await getOrganizationAuditLogs(
      app,
      ownerToken,
      organizationId,
      { perPage: 101 },
    );
    expect(tooLargeResponse.status).toBe(400);
  });

  it("ページ範囲が大きすぎる場合は 400 Bad Request", async () => {
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

    const response = await getOrganizationAuditLogs(
      app,
      ownerToken,
      organizationId,
      { page: 501, perPage: 21 },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("page が上限を超える場合は 400 Bad Request", async () => {
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

    const response = await getOrganizationAuditLogs(
      app,
      ownerToken,
      organizationId,
      { page: 10001 },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("他組織の監査ログは含まれない", async () => {
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
    const firstOrganizationId = await createOrganization(
      app,
      ownerToken,
      "First Inc.",
      "first-inc",
    );
    const secondOrganizationId = await createOrganization(
      app,
      ownerToken,
      "Second Inc.",
      "second-inc",
    );
    await addMember(secondOrganizationId, otherUserId, "admin");
    await createTicket(
      app,
      ownerToken,
      firstOrganizationId,
      "first org ticket",
    );
    await createTicket(
      app,
      ownerToken,
      secondOrganizationId,
      "second org ticket",
    );

    const response = await getOrganizationAuditLogs(
      app,
      otherToken,
      secondOrganizationId,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    const auditLogs = body.data.auditLogs as Array<{
      newValues: { title?: string } | null;
    }>;
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]?.newValues?.title).toBe("second org ticket");
  });

  it("無効な organizationId の場合は 400 Bad Request", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    await createOrganization(app, ownerToken, "Acme Inc.", "acme-inc");

    const response = await app.request(
      "/api/organizations/invalid-id/audit-logs",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${ownerToken}` },
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
});

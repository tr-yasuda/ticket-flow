import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../../../src/lib/prisma.js";
import { createApp } from "../../../src/routes/index.js";

function uniqueEmail(prefix: string): string {
  return `${prefix}-${randomUUID()}@example.com`;
}

async function cleanAll(): Promise<void> {
  await prisma.organizationMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

async function registerUser(
  app: ReturnType<typeof createApp>,
  email: string,
  password: string,
): Promise<{ userId: string; accessToken: string }> {
  const response = await app.request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    headers: { "Content-Type": "application/json" },
  });
  const body = await response.json();
  if (!body.success) {
    throw new Error(`ユーザー登録に失敗しました: ${JSON.stringify(body)}`);
  }
  return {
    userId: body.data.user.id,
    accessToken: body.data.accessToken,
  };
}

async function createOrganization(
  app: ReturnType<typeof createApp>,
  accessToken: string,
  name: string,
  slug: string,
): Promise<string> {
  const response = await app.request("/api/organizations", {
    method: "POST",
    body: JSON.stringify({ name, slug }),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const body = await response.json();
  if (!body.success) {
    throw new Error(`組織作成に失敗しました: ${JSON.stringify(body)}`);
  }
  return body.data.id;
}

describe("GET /api/organizations/:organizationId 組織スコープ検証", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    await cleanAll();
    app = createApp();
  });
  afterAll(async () => {
    await cleanAll();
  });

  it("所属組織にアクセスできる", async () => {
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

    const response = await app.request(`/api/organizations/${organizationId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.organizationId).toBe(organizationId);
    expect(body.data.organizationRole).toBe("owner");
  });

  it("member ロールでも所属組織にアクセスできる", async () => {
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
    await prisma.organizationMember.create({
      data: {
        organizationId,
        userId: memberUserId,
        role: "member",
      },
    });

    const response = await app.request(`/api/organizations/${organizationId}`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.organizationId).toBe(organizationId);
    expect(body.data.organizationRole).toBe("member");
  });

  it("他組織にアクセスすると 403 を返す", async () => {
    const { accessToken: userAToken } = await registerUser(
      app,
      uniqueEmail("user-a"),
      "password123",
    );
    const { accessToken: userBToken } = await registerUser(
      app,
      uniqueEmail("user-b"),
      "password123",
    );
    const organizationAId = await createOrganization(
      app,
      userAToken,
      "Org A",
      "org-a",
    );
    await createOrganization(app, userBToken, "Org B", "org-b");

    const response = await app.request(
      `/api/organizations/${organizationAId}`,
      {
        headers: { Authorization: `Bearer ${userBToken}` },
      },
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_FORBIDDEN");
  });

  it("存在しない organizationId の場合は 403 を返す", async () => {
    const { accessToken } = await registerUser(
      app,
      uniqueEmail("user"),
      "password123",
    );

    const response = await app.request(`/api/organizations/${randomUUID()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

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

    const response = await app.request("/api/organizations/invalid-id", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("未認証の場合は 401 を返す", async () => {
    const response = await app.request(
      "/api/organizations/550e8400-e29b-41d4-a716-446655440000",
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_UNAUTHORIZED");
  });
});

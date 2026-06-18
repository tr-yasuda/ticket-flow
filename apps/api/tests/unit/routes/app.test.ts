import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../../../src/lib/prisma.js";
import { createApp } from "../../../src/routes/index.js";

async function cleanAll(): Promise<void> {
  await prisma.organizationMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

describe("createApp", () => {
  beforeEach(cleanAll);
  afterAll(async () => {
    await cleanAll();
    await prisma.$disconnect();
  });

  it("GET /api/me は未認証時に 401 を返す", async () => {
    const app = createApp();

    const response = await app.request("/api/me");

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_UNAUTHORIZED");
  });

  it("POST /api/auth/register でユーザー登録", async () => {
    const app = createApp();

    const response = await app.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: "user@example.com",
        password: "password123",
      }),
      headers: { "Content-Type": "application/json" },
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe("user@example.com");
    expect(body.data.accessToken).toBeTruthy();
    expect(body.data.refreshToken).toBeTruthy();
  });

  it("POST /api/auth/register でバリデーションエラー", async () => {
    const app = createApp();

    const response = await app.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: "invalid", password: "short" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("POST /api/organizations は未認証時に 401 を返す", async () => {
    const app = createApp();

    const response = await app.request("/api/organizations", {
      method: "POST",
      body: JSON.stringify({ name: "Acme Inc.", slug: "acme-inc" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_UNAUTHORIZED");
  });

  it("GET /api/organizations は未認証時に 401 を返す", async () => {
    const app = createApp();

    const response = await app.request("/api/organizations");

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_UNAUTHORIZED");
  });

  it("GET /api/organizations はアクセストークン付きで 200 を返す", async () => {
    const app = createApp();
    const registerResponse = await app.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: "member@example.com",
        password: "password123",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const registerBody = await registerResponse.json();
    const accessToken = registerBody.data.accessToken;

    const response = await app.request("/api/organizations", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.organizations).toEqual([]);
  });

  it("GET /api/me はアクセストークン付きで 200 を返す", async () => {
    const app = createApp();
    const registerResponse = await app.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: "user@example.com",
        password: "password123",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const registerBody = await registerResponse.json();
    const accessToken = registerBody.data.accessToken;

    const response = await app.request("/api/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe("user@example.com");
  });

  it("POST /api/organizations はアクセストークン付きで 201 を返す", async () => {
    const app = createApp();
    const registerResponse = await app.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: "user@example.com",
        password: "password123",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const registerBody = await registerResponse.json();
    const accessToken = registerBody.data.accessToken;

    const response = await app.request("/api/organizations", {
      method: "POST",
      body: JSON.stringify({ name: "Acme Inc.", slug: "acme-inc" }),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.slug).toBe("acme-inc");
  });

  it("POST /api/auth/register で不正な JSON ボディの場合 400 を返す", async () => {
    const app = createApp();

    const response = await app.request("/api/auth/register", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });

    expect(response.status).toBe(400);
  });
});

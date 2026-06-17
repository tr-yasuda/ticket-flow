import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { createOrganization } from "../../../../src/domain/organization.js";
import { InMemoryOrganizationMemberRepository } from "../../../../src/infrastructure/database/in-memory-organization-member-repository.js";
import { InMemoryOrganizationRepository } from "../../../../src/infrastructure/database/in-memory-organization-repository.js";
import { noOpTransactionRunner } from "../../../../src/infrastructure/database/no-op-transaction-runner.js";
import { createCreateOrganizationHandler } from "../../../../src/presentation/handlers/create-organization-handler.js";

function createTestApp(userId: string | undefined) {
  const organizationRepository = new InMemoryOrganizationRepository();
  const organizationMemberRepository =
    new InMemoryOrganizationMemberRepository();
  const app = new Hono();
  app.use(async (c, next) => {
    if (userId !== undefined) {
      c.set("userId", userId);
    }
    await next();
  });
  app.post(
    "/api/organizations",
    createCreateOrganizationHandler({
      organizationRepository,
      organizationMemberRepository,
      transactionRunner: noOpTransactionRunner,
    }),
  );
  return { app, organizationRepository, organizationMemberRepository };
}

describe("組織作成ハンドラ", () => {
  it("有効なリクエストで組織を作成し 201 を返す", async () => {
    const { app } = createTestApp("user-1");

    const res = await app.request("/api/organizations", {
      method: "POST",
      body: JSON.stringify({ name: "Acme Inc.", slug: "acme-inc" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe("Acme Inc.");
    expect(body.data.slug).toBe("acme-inc");
  });

  it("name が空の場合は 400 を返す", async () => {
    const { app } = createTestApp("user-1");

    const res = await app.request("/api/organizations", {
      method: "POST",
      body: JSON.stringify({ name: "", slug: "acme-inc" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("slug が不正な場合は 400 を返す", async () => {
    const { app } = createTestApp("user-1");

    const res = await app.request("/api/organizations", {
      method: "POST",
      body: JSON.stringify({ name: "Acme Inc.", slug: "Acme Inc" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("JSON ボディが不正な場合は 400 を返す", async () => {
    const { app } = createTestApp("user-1");

    const res = await app.request("/api/organizations", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("slug が既に存在する場合は 409 を返す", async () => {
    const { app, organizationRepository } = createTestApp("user-1");
    const existing = createOrganization("Acme Inc.", "acme-inc");
    await organizationRepository.save(existing);

    const res = await app.request("/api/organizations", {
      method: "POST",
      body: JSON.stringify({ name: "Other", slug: "acme-inc" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("CONFLICT");
  });

  it("userId が設定されていない場合は 401 を返す", async () => {
    const { app } = createTestApp(undefined);

    const res = await app.request("/api/organizations", {
      method: "POST",
      body: JSON.stringify({ name: "Acme Inc.", slug: "acme-inc" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_UNAUTHORIZED");
  });
});

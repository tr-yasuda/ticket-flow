import { createHash } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { sendInvitationEmail } from "../../../src/lib/invitation-mailer.js";
import { prisma } from "../../../src/lib/prisma.js";
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
  await prisma.organizationMember.create({
    data: {
      organizationId,
      userId,
      role,
    },
  });
}

async function createInvitation(
  app: ReturnType<typeof createApp>,
  accessToken: string,
  organizationId: string,
  email: string,
  role: "admin" | "member" | "viewer" = "member",
): Promise<Response> {
  return app.request(`/api/organizations/${organizationId}/invitations`, {
    method: "POST",
    body: JSON.stringify({ email, role }),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function getSentInvitationToken(): Promise<string> {
  await vi.waitFor(() => expect(sendInvitationEmail).toHaveBeenCalled());
  const call = sendInvitationEmail.mock.calls[0];
  if (call === undefined) {
    throw new Error("sendInvitationEmail was not called");
  }
  return (call[0] as { token: string }).token;
}

describe("POST /api/organizations/:organizationId/invitations (invitation.create)", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    await cleanAll();
    app = createApp();
    vi.spyOn(
      await import("../../../src/lib/invitation-mailer.js"),
      "sendInvitationEmail",
    );
  });
  afterAll(async () => {
    await cleanAll();
  });

  it("Owner がメンバー招待できる", async () => {
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
    const email = uniqueEmail("invitee");

    const response = await createInvitation(
      app,
      ownerToken,
      organizationId,
      email,
      "member",
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.email).toBe(email.toLowerCase());
    expect(body.data.role).toBe("member");
    expect(body.data.token).toBeUndefined();
    expect(body.data.expiresAt).toEqual(expect.any(String));

    const token = await getSentInvitationToken();
    const stored = await prisma.organizationInvitation.findUnique({
      where: { id: body.data.id },
    });
    expect(stored).not.toBeNull();
    expect(stored?.email).toBe(email.toLowerCase());
    expect(stored?.tokenHash).toBe(sha256(token));
    expect(stored?.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(stored?.expiresAt.getTime()).toBeLessThanOrEqual(
      Date.now() + 7 * 24 * 60 * 60 * 1000 + 1000,
    );
  });

  it("Admin がメンバー招待できる", async () => {
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

    const response = await createInvitation(
      app,
      adminToken,
      organizationId,
      uniqueEmail("invitee"),
      "member",
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  it("Owner は admin を招待できる", async () => {
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

    const response = await createInvitation(
      app,
      ownerToken,
      organizationId,
      uniqueEmail("invitee"),
      "admin",
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.role).toBe("admin");
  });

  it("Admin は admin を招待できず 403 を返す", async () => {
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

    const response = await createInvitation(
      app,
      adminToken,
      organizationId,
      uniqueEmail("invitee"),
      "admin",
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_FORBIDDEN");
  });

  it("viewer ロールを招待できる", async () => {
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

    const response = await createInvitation(
      app,
      ownerToken,
      organizationId,
      uniqueEmail("invitee"),
      "viewer",
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.role).toBe("viewer");
  });

  it("Member は招待できず 403 を返す", async () => {
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

    const response = await createInvitation(
      app,
      memberToken,
      organizationId,
      uniqueEmail("invitee"),
      "member",
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_FORBIDDEN");
  });

  it("Viewer は招待できず 403 を返す", async () => {
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

    const response = await createInvitation(
      app,
      viewerToken,
      organizationId,
      uniqueEmail("invitee"),
      "member",
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_FORBIDDEN");
  });

  it("組織に所属していないユーザーは 403 を返す", async () => {
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

    const response = await createInvitation(
      app,
      otherToken,
      organizationId,
      uniqueEmail("invitee"),
      "member",
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_FORBIDDEN");
  });

  it("既存メンバーのメールアドレスには 409 を返す", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const memberEmail = uniqueEmail("member");
    const { userId: memberUserId } = await registerUser(
      app,
      memberEmail,
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    await addMember(organizationId, memberUserId, "member");

    const response = await createInvitation(
      app,
      ownerToken,
      organizationId,
      memberEmail,
      "member",
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("CONFLICT");
  });

  it("既存メンバー判定ではメールアドレスの大文字小文字を区別しない", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const memberEmail = uniqueEmail("member");
    const { userId: memberUserId } = await registerUser(
      app,
      memberEmail,
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    await addMember(organizationId, memberUserId, "member");

    const response = await createInvitation(
      app,
      ownerToken,
      organizationId,
      memberEmail.toUpperCase(),
      "member",
    );

    expect(response.status).toBe(409);
  });

  it("同一メールアドレスへの重複招待は 409 を返す", async () => {
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
    const email = uniqueEmail("invitee");

    const first = await createInvitation(
      app,
      ownerToken,
      organizationId,
      email,
      "member",
    );
    expect(first.status).toBe(201);
    await getSentInvitationToken();

    sendInvitationEmail.mockClear();

    const second = await createInvitation(
      app,
      ownerToken,
      organizationId,
      email,
      "member",
    );
    expect(second.status).toBe(409);
    const body = await second.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("CONFLICT");
  });

  it("期限切れ招待後は同じメールアドレスへ再招待できる", async () => {
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
    const email = uniqueEmail("invitee");

    const first = await createInvitation(
      app,
      ownerToken,
      organizationId,
      email,
      "member",
    );
    expect(first.status).toBe(201);
    const firstBody = await first.json();
    await getSentInvitationToken();

    await prisma.organizationInvitation.update({
      where: { id: firstBody.data.id },
      data: { expiresAt: new Date(Date.now() - 1) },
    });

    sendInvitationEmail.mockClear();

    const second = await createInvitation(
      app,
      ownerToken,
      organizationId,
      email,
      "member",
    );
    expect(second.status).toBe(201);
    const secondBody = await second.json();
    expect(secondBody.success).toBe(true);
  });

  it("無効なメールアドレスの場合は 400 を返す", async () => {
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

    const response = await createInvitation(
      app,
      ownerToken,
      organizationId,
      "not-an-email",
      "member",
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("空のメールアドレスの場合は 400 を返す", async () => {
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

    const response = await createInvitation(
      app,
      ownerToken,
      organizationId,
      "",
      "member",
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("owner ロールは招待できず 400 を返す", async () => {
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

    const response = await createInvitation(
      app,
      ownerToken,
      organizationId,
      uniqueEmail("invitee"),
      "owner",
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("未認証の場合は 401 を返す", async () => {
    const response = await app.request(
      "/api/organizations/550e8400-e29b-41d4-a716-446655440000/invitations",
      {
        method: "POST",
        body: JSON.stringify({ email: uniqueEmail("invitee"), role: "member" }),
        headers: { "Content-Type": "application/json" },
      },
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_UNAUTHORIZED");
  });

  it("無効な organizationId の場合は 400 を返す", async () => {
    const { accessToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );

    const response = await app.request(
      "/api/organizations/invalid-id/invitations",
      {
        method: "POST",
        body: JSON.stringify({ email: uniqueEmail("invitee"), role: "member" }),
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
  });
});

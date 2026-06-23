import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { hashRefreshToken } from "../../../src/domain/refresh-token.js";
import { prisma } from "../../../src/lib/prisma.js";
import { createApp } from "../../../src/routes/index.js";
import {
  cleanAll,
  createInvitation,
  createOrganization,
  hashInvitationToken,
  registerUser,
  uniqueEmail,
} from "../helpers/organization-test-helpers.js";

async function acceptInvitation(
  app: ReturnType<typeof createApp>,
  token: string,
  options: {
    accessToken?: string;
    email?: string;
    password?: string;
  } = {},
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (options.accessToken !== undefined) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }
  if (options.email !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  return app.request(`/api/invitations/${token}/accept`, {
    method: "POST",
    body:
      options.email !== undefined
        ? JSON.stringify({
            email: options.email,
            password: options.password ?? "password123",
          })
        : undefined,
    headers,
  });
}

describe("POST /api/invitations/:token/accept (invitation.accept)", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    vi.clearAllMocks();
    await cleanAll();
    app = createApp();
  });
  afterAll(async () => {
    await cleanAll();
  });

  it("認証済みユーザーが有効なトークンで承諾するとメンバーになる", async () => {
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
    const inviteeEmail = uniqueEmail("invitee");
    const { accessToken: inviteeToken } = await registerUser(
      app,
      inviteeEmail,
      "password123",
    );
    const { token } = await createInvitation(
      organizationId,
      inviteeEmail,
      "member",
    );

    const response = await acceptInvitation(app, token, {
      accessToken: inviteeToken,
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.membership.organizationId).toBe(organizationId);
    expect(body.data.membership.role).toBe("member");
    expect(body.data.user.email).toBe(inviteeEmail.toLowerCase());
    expect(body.data.accessToken).toBeUndefined();
    expect(body.data.refreshToken).toBeUndefined();

    const storedInvitation = await prisma.organizationInvitation.findUnique({
      where: { tokenHash: hashInvitationToken(token) },
    });
    expect(storedInvitation).toBeNull();

    const member = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: body.data.user.id,
        },
      },
    });
    expect(member).not.toBeNull();
    expect(member?.role).toBe("member");
  });

  it("未登録ユーザーがトークンと同時に登録・承諾できる", async () => {
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
    const inviteeEmail = uniqueEmail("invitee");
    const { token } = await createInvitation(
      organizationId,
      inviteeEmail,
      "viewer",
    );

    const response = await acceptInvitation(app, token, {
      email: inviteeEmail,
      password: "password123",
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.membership.organizationId).toBe(organizationId);
    expect(body.data.membership.role).toBe("viewer");
    expect(body.data.user.email).toBe(inviteeEmail.toLowerCase());
    expect(body.data.accessToken).toEqual(expect.any(String));
    expect(body.data.refreshToken).toEqual(expect.any(String));

    const storedInvitation = await prisma.organizationInvitation.findUnique({
      where: { tokenHash: hashInvitationToken(token) },
    });
    expect(storedInvitation).toBeNull();

    const member = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: body.data.user.id,
        },
      },
    });
    expect(member).not.toBeNull();
    expect(member?.role).toBe("viewer");

    const refreshToken = await prisma.refreshToken.findUnique({
      where: {
        tokenHash: hashRefreshToken(body.data.refreshToken),
      },
    });
    expect(refreshToken).not.toBeNull();
    expect(refreshToken?.userId).toBe(body.data.user.id);
  });

  it("無効なトークンでは 400 を返す", async () => {
    const response = await acceptInvitation(app, "invalid-token", {
      email: uniqueEmail("invitee"),
      password: "password123",
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("期限切れトークンでは 400 を返す", async () => {
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
    const inviteeEmail = uniqueEmail("invitee");
    const { id, token } = await createInvitation(
      organizationId,
      inviteeEmail,
      "member",
    );
    await prisma.organizationInvitation.update({
      where: { id },
      data: { expiresAt: new Date(Date.now() - 1) },
    });

    const response = await acceptInvitation(app, token, {
      email: inviteeEmail,
      password: "password123",
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("使用済みトークンでは 400 を返す", async () => {
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
    const inviteeEmail = uniqueEmail("invitee");
    const { token } = await createInvitation(
      organizationId,
      inviteeEmail,
      "member",
    );

    const first = await acceptInvitation(app, token, {
      email: inviteeEmail,
      password: "password123",
    });
    expect(first.status).toBe(201);

    const second = await acceptInvitation(app, token, {
      email: inviteeEmail,
      password: "password123",
    });

    expect(second.status).toBe(400);
    const body = await second.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("招待されたメールアドレスと異なる場合は 400 を返す", async () => {
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
    const inviteeEmail = uniqueEmail("invitee");
    const { token } = await createInvitation(
      organizationId,
      inviteeEmail,
      "member",
    );

    const response = await acceptInvitation(app, token, {
      email: uniqueEmail("other"),
      password: "password123",
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("認証済みユーザーのメールアドレスが招待と異なる場合は 400 を返す", async () => {
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
    const inviteeEmail = uniqueEmail("invitee");
    const { accessToken: otherToken } = await registerUser(
      app,
      uniqueEmail("other"),
      "password123",
    );
    const { token } = await createInvitation(
      organizationId,
      inviteeEmail,
      "member",
    );

    const response = await acceptInvitation(app, token, {
      accessToken: otherToken,
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("既にメンバーのユーザーは 409 を返す", async () => {
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
    const inviteeEmail = uniqueEmail("invitee");
    const { userId: inviteeUserId } = await registerUser(
      app,
      inviteeEmail,
      "password123",
    );
    const { token } = await createInvitation(
      organizationId,
      inviteeEmail,
      "member",
    );
    await prisma.organizationMember.create({
      data: { organizationId, userId: inviteeUserId, role: "member" },
    });

    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: inviteeEmail, password: "password123" }),
      headers: { "Content-Type": "application/json" },
    });
    const loginBody = await loginResponse.json();
    expect(loginBody.success).toBe(true);

    const response = await acceptInvitation(app, token, {
      accessToken: loginBody.data.accessToken,
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("CONFLICT");
  });

  it("認証情報も登録情報もない場合は 400 を返す", async () => {
    const response = await app.request("/api/invitations/some-token/accept", {
      method: "POST",
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("無効な認証トークンでは 401 を返す", async () => {
    const response = await app.request("/api/invitations/some-token/accept", {
      method: "POST",
      headers: { Authorization: "Bearer invalid-token" },
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_UNAUTHORIZED");
  });

  it("認証情報と登録情報を同時に指定すると 400 を返す", async () => {
    const { accessToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );

    const response = await app.request("/api/invitations/some-token/accept", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: uniqueEmail("invitee"),
        password: "password123",
      }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("未登録フローで既存ユーザーのメールアドレスでは 409 を返す", async () => {
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
    const inviteeEmail = uniqueEmail("invitee");
    await registerUser(app, inviteeEmail, "password123");
    const { token } = await createInvitation(
      organizationId,
      inviteeEmail,
      "member",
    );

    const response = await acceptInvitation(app, token, {
      email: inviteeEmail,
      password: "password123",
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("CONFLICT");
  });
});

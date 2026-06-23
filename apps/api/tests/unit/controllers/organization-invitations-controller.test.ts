import type { Context } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  acceptOrganizationInvitationController,
  createOrganizationInvitationController,
} from "../../../src/controllers/organization-invitations-controller.js";
import type { OrganizationMemberRole } from "../../../src/domain/organization-member.js";
import * as tokenDomain from "../../../src/domain/token.js";
import * as auditLogRepository from "../../../src/infrastructure/database/audit-log-repository.js";
import * as invitationMailQueue from "../../../src/lib/invitation-mail-queue.js";
import * as organizationInvitationsService from "../../../src/services/organization-invitations-service.js";

function createTestContext({
  body,
  userId,
  organizationId,
  organizationRole,
}: {
  body?: unknown;
  userId?: string;
  organizationId?: string;
  organizationRole?: OrganizationMemberRole;
} = {}): Context {
  const json = vi.fn();
  const c = {
    req: {
      valid: vi.fn().mockImplementation((target: string) => {
        if (target === "json") {
          return body;
        }
        return undefined;
      }),
      header: vi.fn().mockReturnValue(undefined),
    },
    json,
    body: vi.fn(),
    get: vi.fn().mockImplementation((key: string) => {
      if (key === "userId") {
        return userId;
      }
      if (key === "organizationId") {
        return organizationId;
      }
      if (key === "organizationRole") {
        return organizationRole;
      }
      return undefined;
    }),
  } as unknown as Context;
  return c;
}

describe("organization-invitations-controller", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("招待作成成功時に 201 を返し、トークンはレスポンスに含めない", async () => {
    vi.spyOn(
      organizationInvitationsService,
      "createOrganizationInvitation",
    ).mockResolvedValue({
      success: true,
      data: {
        id: "invitation-id",
        organizationId: "org-id",
        email: "invitee@example.com",
        role: "member",
        token: "secret-token",
        expiresAt: new Date("2026-07-01T00:00:00.000Z"),
      },
    });
    const enqueueSpy = vi
      .spyOn(invitationMailQueue, "enqueueInvitationEmail")
      .mockReturnValue(undefined);
    vi.spyOn(auditLogRepository, "saveAuditLog").mockResolvedValue(
      undefined as Awaited<ReturnType<typeof auditLogRepository.saveAuditLog>>,
    );

    const c = createTestContext({
      body: { email: "invitee@example.com", role: "member" },
      userId: "user-id",
      organizationId: "org-id",
      organizationRole: "owner",
    });

    await createOrganizationInvitationController(c);

    expect(enqueueSpy).toHaveBeenCalledWith({
      email: "invitee@example.com",
      organizationId: "org-id",
      token: "secret-token",
    });
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          id: "invitation-id",
          organizationId: "org-id",
          email: "invitee@example.com",
          role: "member",
          expiresAt: "2026-07-01T00:00:00.000Z",
        }),
      }),
      201,
    );
    const responseBody = (c.json as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0];
    expect(responseBody.data.token).toBeUndefined();
  });

  it("already-member エラー時に 409 を返す", async () => {
    vi.spyOn(
      organizationInvitationsService,
      "createOrganizationInvitation",
    ).mockResolvedValue({
      success: false,
      error: { type: "already-member", message: "Already a member" },
    });

    const c = createTestContext({
      body: { email: "member@example.com", role: "member" },
      userId: "user-id",
      organizationId: "org-id",
      organizationRole: "owner",
    });

    await createOrganizationInvitationController(c);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "CONFLICT" }),
      }),
      409,
    );
  });

  it("already-invited エラー時に 409 を返す", async () => {
    vi.spyOn(
      organizationInvitationsService,
      "createOrganizationInvitation",
    ).mockResolvedValue({
      success: false,
      error: { type: "already-invited", message: "Already invited" },
    });

    const c = createTestContext({
      body: { email: "invited@example.com", role: "member" },
      userId: "user-id",
      organizationId: "org-id",
      organizationRole: "owner",
    });

    await createOrganizationInvitationController(c);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "CONFLICT" }),
      }),
      409,
    );
  });

  it("insufficient-role エラー時に 403 を返す", async () => {
    vi.spyOn(
      organizationInvitationsService,
      "createOrganizationInvitation",
    ).mockResolvedValue({
      success: false,
      error: { type: "insufficient-role", message: "Insufficient role" },
    });

    const c = createTestContext({
      body: { email: "invitee@example.com", role: "admin" },
      userId: "user-id",
      organizationId: "org-id",
      organizationRole: "admin",
    });

    await createOrganizationInvitationController(c);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "AUTH_FORBIDDEN" }),
      }),
      403,
    );
  });

  it("invalid-role エラー時に 400 を返す", async () => {
    vi.spyOn(
      organizationInvitationsService,
      "createOrganizationInvitation",
    ).mockResolvedValue({
      success: false,
      error: { type: "invalid-role", message: "Invalid role" },
    });

    const c = createTestContext({
      body: { email: "invitee@example.com", role: "owner" },
      userId: "user-id",
      organizationId: "org-id",
      organizationRole: "owner",
    });

    await createOrganizationInvitationController(c);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      }),
      400,
    );
  });
});

function createAcceptTestContext({
  token,
  body,
  authorization,
  contentType,
}: {
  token?: string;
  body?: unknown;
  authorization?: string;
  contentType?: string;
} = {}): Context {
  const json = vi
    .fn()
    .mockImplementation((responseBody: unknown, status?: number) => {
      return new Response(JSON.stringify(responseBody), {
        status: status ?? 200,
        headers: { "Content-Type": "application/json" },
      });
    });
  const jsonFn = vi.fn();
  if (body !== undefined) {
    jsonFn.mockResolvedValue(body);
  }
  const c = {
    req: {
      param: vi.fn().mockReturnValue(token),
      json: jsonFn,
      header: vi.fn().mockImplementation((name: string) => {
        if (name === "Authorization") {
          return authorization;
        }
        if (name === "Content-Type") {
          return contentType;
        }
        return undefined;
      }),
    },
    json,
    body: vi.fn(),
    get: vi.fn(),
  } as unknown as Context;
  return c;
}

function mockSaveAuditLog(): ReturnType<typeof vi.spyOn> {
  return vi
    .spyOn(auditLogRepository, "saveAuditLog")
    .mockResolvedValue(
      undefined as Awaited<ReturnType<typeof auditLogRepository.saveAuditLog>>,
    );
}

describe("acceptOrganizationInvitationController", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("認証済みユーザーが承諾成功時に 201 を返す", async () => {
    vi.spyOn(tokenDomain, "verifyAccessToken").mockResolvedValue({
      userId: "user-id",
    });
    vi.spyOn(
      organizationInvitationsService,
      "acceptOrganizationInvitation",
    ).mockResolvedValue({
      success: true,
      data: {
        membership: {
          id: "member-id",
          organizationId: "org-id",
          userId: "user-id",
          role: "member",
        },
        user: { id: "user-id", email: "invitee@example.com" },
        invitationId: "invitation-id",
      },
    });
    const saveAuditLogSpy = mockSaveAuditLog();

    const c = createAcceptTestContext({
      token: "valid-token",
      authorization: "Bearer valid-access-token",
    });

    await acceptOrganizationInvitationController(c);

    expect(tokenDomain.verifyAccessToken).toHaveBeenCalledWith(
      "valid-access-token",
      expect.any(Object),
    );
    expect(
      organizationInvitationsService.acceptOrganizationInvitation,
    ).toHaveBeenCalledWith({
      token: "valid-token",
      authenticatedUserId: "user-id",
    });
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          membership: expect.objectContaining({ role: "member" }),
          user: { id: "user-id", email: "invitee@example.com" },
        }),
      }),
      201,
    );
    expect(saveAuditLogSpy).toHaveBeenCalled();
  });

  it("未登録ユーザーが同時登録・承諾成功時に 201 を返す", async () => {
    vi.spyOn(
      organizationInvitationsService,
      "acceptOrganizationInvitation",
    ).mockResolvedValue({
      success: true,
      data: {
        membership: {
          id: "member-id",
          organizationId: "org-id",
          userId: "user-id",
          role: "viewer",
        },
        user: { id: "user-id", email: "invitee@example.com" },
        accessToken: "access-token",
        refreshToken: "refresh-token",
        invitationId: "invitation-id",
      },
    });
    const saveAuditLogSpy = mockSaveAuditLog();

    const c = createAcceptTestContext({
      token: "valid-token",
      body: { email: "invitee@example.com", password: "password123" },
    });

    await acceptOrganizationInvitationController(c);

    expect(
      organizationInvitationsService.acceptOrganizationInvitation,
    ).toHaveBeenCalledWith({
      token: "valid-token",
      email: "invitee@example.com",
      password: "password123",
    });
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          accessToken: "access-token",
          refreshToken: "refresh-token",
        }),
      }),
      201,
    );
    expect(saveAuditLogSpy).toHaveBeenCalled();
  });

  it("トークンが空の場合は 400 を返す", async () => {
    const c = createAcceptTestContext({ token: "" });

    await acceptOrganizationInvitationController(c);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      }),
      400,
    );
  });

  it("無効な認証トークンでは 401 を返す", async () => {
    vi.spyOn(tokenDomain, "verifyAccessToken").mockRejectedValue(
      new Error("Invalid token"),
    );

    const c = createAcceptTestContext({
      token: "valid-token",
      authorization: "Bearer invalid-access-token",
    });

    await acceptOrganizationInvitationController(c);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "AUTH_UNAUTHORIZED" }),
      }),
      401,
    );
  });

  it("認証ヘッダーが Bearer 形式でない場合は 401 を返す", async () => {
    vi.spyOn(tokenDomain, "verifyAccessToken").mockResolvedValue({
      userId: "user-id",
    });

    const c = createAcceptTestContext({
      token: "valid-token",
      authorization: "Basic dXNlcjpwYXNz",
    });

    await acceptOrganizationInvitationController(c);

    expect(tokenDomain.verifyAccessToken).not.toHaveBeenCalled();
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "AUTH_UNAUTHORIZED" }),
      }),
      401,
    );
  });

  it("認証ヘッダーと JSON ボディが両方指定された場合は 400 を返す", async () => {
    vi.spyOn(
      organizationInvitationsService,
      "acceptOrganizationInvitation",
    ).mockResolvedValue({
      success: true,
      data: {
        membership: {
          id: "member-id",
          organizationId: "org-id",
          userId: "user-id",
          role: "member",
        },
        user: { id: "user-id", email: "invitee@example.com" },
        invitationId: "invitation-id",
      },
    });

    const c = createAcceptTestContext({
      token: "valid-token",
      authorization: "Bearer valid-access-token",
      contentType: "application/json",
      body: { email: "invitee@example.com", password: "password123" },
    });

    await acceptOrganizationInvitationController(c);

    expect(
      organizationInvitationsService.acceptOrganizationInvitation,
    ).not.toHaveBeenCalled();
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      }),
      400,
    );
  });

  it("JSON ボディのパースに失敗した場合は 400 を返す", async () => {
    const c = createAcceptTestContext({ token: "valid-token" });
    c.req.json = vi.fn().mockRejectedValue(new Error("Invalid JSON"));

    await acceptOrganizationInvitationController(c);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      }),
      400,
    );
  });

  it("登録情報が不正な場合は 400 を返し、フィールドごとの詳細を含む", async () => {
    const c = createAcceptTestContext({
      token: "valid-token",
      body: { email: "not-an-email", password: "short" },
    });

    await acceptOrganizationInvitationController(c);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
          details: expect.arrayContaining([
            expect.objectContaining({ field: "email" }),
            expect.objectContaining({ field: "password" }),
          ]),
        }),
      }),
      400,
    );
  });

  it("invalid-token エラー時に 400 を返す", async () => {
    vi.spyOn(
      organizationInvitationsService,
      "acceptOrganizationInvitation",
    ).mockResolvedValue({
      success: false,
      error: { type: "invalid-token", message: "無効な招待トークンです" },
    });

    const c = createAcceptTestContext({
      token: "valid-token",
      body: { email: "invitee@example.com", password: "password123" },
    });

    await acceptOrganizationInvitationController(c);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
          details: [{ field: "token", message: "無効な招待トークンです" }],
        }),
      }),
      400,
    );
  });

  it("expired-token エラー時に 400 を返す", async () => {
    vi.spyOn(
      organizationInvitationsService,
      "acceptOrganizationInvitation",
    ).mockResolvedValue({
      success: false,
      error: {
        type: "expired-token",
        message: "招待トークンの有効期限が切れています",
      },
    });

    const c = createAcceptTestContext({
      token: "valid-token",
      body: { email: "invitee@example.com", password: "password123" },
    });

    await acceptOrganizationInvitationController(c);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
          details: [
            {
              field: "token",
              message: "招待トークンの有効期限が切れています",
            },
          ],
        }),
      }),
      400,
    );
  });

  it("already-member エラー時に 409 を返す", async () => {
    vi.spyOn(tokenDomain, "verifyAccessToken").mockResolvedValue({
      userId: "user-id",
    });
    vi.spyOn(
      organizationInvitationsService,
      "acceptOrganizationInvitation",
    ).mockResolvedValue({
      success: false,
      error: { type: "already-member", message: "既に組織のメンバーです" },
    });

    const c = createAcceptTestContext({
      token: "valid-token",
      authorization: "Bearer valid-access-token",
    });

    await acceptOrganizationInvitationController(c);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "CONFLICT" }),
      }),
      409,
    );
  });

  it("email-already-exists エラー時に 409 を返す", async () => {
    vi.spyOn(
      organizationInvitationsService,
      "acceptOrganizationInvitation",
    ).mockResolvedValue({
      success: false,
      error: {
        type: "email-already-exists",
        message: "指定されたメールアドレスは既に登録されています",
      },
    });

    const c = createAcceptTestContext({
      token: "valid-token",
      body: { email: "invitee@example.com", password: "password123" },
    });

    await acceptOrganizationInvitationController(c);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "CONFLICT" }),
      }),
      409,
    );
  });
});

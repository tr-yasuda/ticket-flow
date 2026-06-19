import type { Context } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createOrganizationInvitationController } from "../../../src/controllers/organization-invitations-controller.js";
import type { OrganizationMemberRole } from "../../../src/domain/organization-member.js";
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
      {} as ReturnType<typeof auditLogRepository.saveAuditLog> extends Promise<
        infer T
      >
        ? T
        : never,
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

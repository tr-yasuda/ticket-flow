import { randomUUID } from "node:crypto";

import { hashInvitationToken } from "../../../src/domain/organization-invitation.js";
import { resetInvitationMailQueue } from "../../../src/lib/invitation-mail-queue.js";
import { prisma } from "../../../src/lib/prisma.js";
import { resetRateLimit } from "../../../src/lib/rate-limiter.js";
import { createApp } from "../../../src/routes/index.js";
import { createOrganizationInvitation } from "../../../src/services/organization-invitations-service.js";

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${randomUUID()}@example.com`;
}

export async function cleanAll(): Promise<void> {
  resetRateLimit();
  resetInvitationMailQueue();
  await prisma.ticket.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.organizationInvitation.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

export async function registerUser(
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

export async function createOrganization(
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

export async function createInvitation(
  organizationId: string,
  email: string,
  role: "admin" | "member" | "viewer" = "member",
  inviterRole: "owner" | "admin" = "owner",
): Promise<{ id: string; token: string }> {
  const result = await createOrganizationInvitation({
    organizationId,
    email,
    role,
    inviterRole,
  });
  if (!result.success) {
    throw new Error(`招待作成に失敗しました: ${result.error.message}`);
  }
  return { id: result.data.id, token: result.data.token };
}

export { hashInvitationToken };

import { createHash, randomBytes, randomUUID } from "node:crypto";

import { invitableRoles } from "@ticket-flow/shared";

import type { OrganizationMemberRole } from "./organization-member.js";

export type OrganizationInvitationId = string;
export type OrganizationInvitationToken = string;
export type OrganizationInvitationTokenHash = string;

const INVITATION_TOKEN_BYTES = 32;
const INVITATION_EXPIRES_IN_MS = 7 * 24 * 60 * 60 * 1000;

export type OrganizationInvitation = Readonly<{
  id: OrganizationInvitationId;
  organizationId: string;
  email: string;
  role: OrganizationMemberRole;
  tokenHash: OrganizationInvitationTokenHash;
  expiresAt: Date;
}>;

export type CreatedOrganizationInvitation = Readonly<{
  invitation: OrganizationInvitation;
  token: string;
}>;

export class InvalidInvitationRoleError extends Error {
  constructor(role: string) {
    super(`role "${role}" は招待できません`);
    this.name = "InvalidInvitationRoleError";
  }
}

export function normalizeInvitationEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateInvitationToken(): string {
  return randomBytes(INVITATION_TOKEN_BYTES).toString("base64url");
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isInvitableRole(role: OrganizationMemberRole): boolean {
  return (invitableRoles as readonly OrganizationMemberRole[]).includes(role);
}

function validateInvitationRole(role: OrganizationMemberRole): void {
  if (!isInvitableRole(role)) {
    throw new InvalidInvitationRoleError(role);
  }
}

export function createOrganizationInvitation(
  organizationId: string,
  email: string,
  role: OrganizationMemberRole,
): CreatedOrganizationInvitation {
  if (organizationId.trim() === "") {
    throw new Error("organizationId is required");
  }

  const normalizedEmail = normalizeInvitationEmail(email);
  if (normalizedEmail === "") {
    throw new Error("email is required");
  }

  validateInvitationRole(role);

  const token = generateInvitationToken();
  const tokenHash = hashInvitationToken(token);

  const invitation: OrganizationInvitation = {
    id: randomUUID(),
    organizationId,
    email: normalizedEmail,
    role,
    tokenHash,
    expiresAt: new Date(Date.now() + INVITATION_EXPIRES_IN_MS),
  };

  return {
    invitation,
    token,
  };
}

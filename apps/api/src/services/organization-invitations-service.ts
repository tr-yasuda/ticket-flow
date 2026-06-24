import { Prisma, type PrismaClient } from "@prisma/client";

import {
  createOrganizationInvitation as createOrganizationInvitationEntity,
  generateInvitationToken,
  hashInvitationToken,
  InvalidInvitationRoleError,
  normalizeInvitationEmail,
} from "../domain/organization-invitation.js";
import {
  createOrganizationMember,
  type OrganizationMember,
  type OrganizationMemberRole,
} from "../domain/organization-member.js";
import { isUniqueConstraintTarget } from "../lib/prisma-error.js";
import { prisma } from "../lib/prisma.js";
import {
  createRegisteredUserWithTokens,
  DuplicateEmailError,
  InvalidPasswordError,
} from "./auth-service.js";

export type CreateOrganizationInvitationInput = Readonly<{
  organizationId: string;
  email: string;
  role: OrganizationMemberRole;
  inviterRole: OrganizationMemberRole;
}>;

export type CreateOrganizationInvitationSuccess = Readonly<{
  id: string;
  organizationId: string;
  email: string;
  role: OrganizationMemberRole;
  token: string;
  expiresAt: Date;
}>;

export type CreateOrganizationInvitationResult =
  | { success: true; data: CreateOrganizationInvitationSuccess }
  | {
      success: false;
      error:
        | { type: "already-member"; message: string }
        | { type: "already-invited"; message: string }
        | { type: "invalid-role"; message: string }
        | { type: "insufficient-role"; message: string };
    };

const MAX_TOKEN_HASH_ATTEMPTS = 5;

function canInviteRole(
  inviterRole: OrganizationMemberRole,
  targetRole: OrganizationMemberRole,
): boolean {
  if (targetRole === "admin") {
    return inviterRole === "owner";
  }
  return true;
}

async function resolveUniqueTokenHash(): Promise<{
  token: string;
  tokenHash: string;
}> {
  const token = generateInvitationToken();
  return {
    token,
    tokenHash: hashInvitationToken(token),
  };
}

function isOrganizationEmailConflict(
  error: Prisma.PrismaClientKnownRequestError,
): boolean {
  return (
    isUniqueConstraintTarget(error, "organization_id") ||
    isUniqueConstraintTarget(error, "email")
  );
}

export async function createOrganizationInvitation(
  input: CreateOrganizationInvitationInput,
  db: PrismaClient = prisma,
): Promise<CreateOrganizationInvitationResult> {
  if (!canInviteRole(input.inviterRole, input.role)) {
    return {
      success: false,
      error: {
        type: "insufficient-role",
        message: "admin を招待できるのは owner だけです",
      },
    };
  }

  let invitationResult;
  try {
    invitationResult = createOrganizationInvitationEntity(
      input.organizationId,
      normalizeInvitationEmail(input.email),
      input.role,
    );
  } catch (error) {
    if (error instanceof InvalidInvitationRoleError) {
      return {
        success: false,
        error: {
          type: "invalid-role",
          message: error.message,
        },
      };
    }
    throw error;
  }

  const { invitation } = invitationResult;
  let token = invitationResult.token;
  let tokenHash = invitation.tokenHash;

  let transactionResult;
  try {
    transactionResult = await db.$transaction(async (tx) => {
      const existingMember = await tx.organizationMember.findFirst({
        where: {
          organizationId: invitation.organizationId,
          user: { email: invitation.email },
        },
        select: { id: true },
      });
      if (existingMember !== null) {
        return { type: "already-member" } as const;
      }

      const existingInvitation = await tx.organizationInvitation.findUnique({
        where: {
          organizationId_email: {
            organizationId: invitation.organizationId,
            email: invitation.email,
          },
        },
      });

      if (
        existingInvitation !== null &&
        existingInvitation.expiresAt > new Date()
      ) {
        return { type: "already-invited" } as const;
      }

      for (let attempt = 1; attempt <= MAX_TOKEN_HASH_ATTEMPTS; attempt++) {
        const existingByToken = await tx.organizationInvitation.findUnique({
          where: { tokenHash },
          select: { id: true },
        });
        if (existingByToken === null) {
          break;
        }
        const regenerated = await resolveUniqueTokenHash();
        token = regenerated.token;
        tokenHash = regenerated.tokenHash;
      }

      const finalExistingByToken = await tx.organizationInvitation.findUnique({
        where: { tokenHash },
        select: { id: true },
      });
      if (finalExistingByToken !== null) {
        throw new Error("招待トークンの一意なハッシュを生成できませんでした");
      }

      if (existingInvitation !== null) {
        await tx.organizationInvitation.update({
          where: {
            organizationId_email: {
              organizationId: invitation.organizationId,
              email: invitation.email,
            },
          },
          data: {
            role: invitation.role,
            tokenHash,
            createdAt: new Date(),
            expiresAt: invitation.expiresAt,
          },
        });
        return { type: "updated", id: existingInvitation.id } as const;
      }

      await tx.organizationInvitation.create({
        data: {
          id: invitation.id,
          organizationId: invitation.organizationId,
          email: invitation.email,
          role: invitation.role,
          tokenHash,
          expiresAt: invitation.expiresAt,
        },
      });

      return { type: "created", id: invitation.id } as const;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      isOrganizationEmailConflict(error)
    ) {
      return {
        success: false,
        error: {
          type: "already-invited",
          message:
            "指定されたメールアドレスには既に有効な招待が送信されています",
        },
      };
    }
    throw error;
  }

  if (transactionResult.type === "already-member") {
    return {
      success: false,
      error: {
        type: "already-member",
        message: "指定されたメールアドレスのユーザーは既に組織のメンバーです",
      },
    };
  }

  if (transactionResult.type === "already-invited") {
    return {
      success: false,
      error: {
        type: "already-invited",
        message: "指定されたメールアドレスには既に有効な招待が送信されています",
      },
    };
  }

  return {
    success: true,
    data: {
      id: transactionResult.id,
      organizationId: invitation.organizationId,
      email: invitation.email,
      role: invitation.role,
      token,
      expiresAt: invitation.expiresAt,
    },
  };
}

type InvitationRow = Readonly<{
  id: string;
  organizationId: string;
  email: string;
  role: OrganizationMemberRole;
  expiresAt: Date;
}>;

async function findInvitationByTokenHash(
  tx: Prisma.TransactionClient,
  tokenHash: string,
): Promise<InvitationRow | null> {
  return tx.organizationInvitation.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      organizationId: true,
      email: true,
      role: true,
      expiresAt: true,
    },
  });
}

type ResolvedAcceptanceUser = Readonly<{
  userId: string;
  userEmail: string;
  accessToken?: string;
  refreshToken?: string;
}>;

async function resolveAuthenticatedAcceptanceUser(
  tx: Prisma.TransactionClient,
  authenticatedUserId: string,
  invitationEmail: string,
): Promise<
  | ResolvedAcceptanceUser
  | { type: "unauthenticated-user" }
  | { type: "email-mismatch" }
> {
  const user = await tx.user.findUnique({
    where: { id: authenticatedUserId },
    select: { id: true, email: true },
  });
  if (user === null) {
    return { type: "unauthenticated-user" } as const;
  }
  if (normalizeInvitationEmail(user.email) !== invitationEmail) {
    return { type: "email-mismatch" } as const;
  }
  return { userId: user.id, userEmail: user.email };
}

async function resolveRegisteredAcceptanceUser(
  tx: Prisma.TransactionClient,
  email: string,
  password: string,
  invitationEmail: string,
): Promise<
  | ResolvedAcceptanceUser
  | { type: "email-mismatch" }
  | { type: "email-already-exists" }
  | { type: "invalid-password"; message: string }
> {
  if (normalizeInvitationEmail(email) !== invitationEmail) {
    return { type: "email-mismatch" } as const;
  }

  try {
    const { user, accessToken, refreshToken } =
      await createRegisteredUserWithTokens({ email, password }, tx);
    return {
      userId: user.id,
      userEmail: user.email,
      accessToken,
      refreshToken,
    };
  } catch (error) {
    if (error instanceof DuplicateEmailError) {
      return { type: "email-already-exists" } as const;
    }
    if (error instanceof InvalidPasswordError) {
      return { type: "invalid-password", message: error.message };
    }
    throw error;
  }
}

async function ensureNotAlreadyMember(
  tx: Prisma.TransactionClient,
  organizationId: string,
  userId: string,
): Promise<boolean> {
  const existingMember = await tx.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    select: { id: true },
  });
  return existingMember === null;
}

async function createMembershipAndDeleteInvitation(
  tx: Prisma.TransactionClient,
  invitation: InvitationRow,
  userId: string,
): Promise<OrganizationMember> {
  const membership = createOrganizationMember(
    invitation.organizationId,
    userId,
    invitation.role,
  );
  await tx.organizationMember.create({
    data: {
      id: membership.id,
      organizationId: membership.organizationId,
      userId: membership.userId,
      role: membership.role,
    },
  });
  await tx.organizationInvitation.delete({
    where: { id: invitation.id },
  });
  return membership;
}

export type AcceptOrganizationInvitationInput =
  | Readonly<{ token: string; authenticatedUserId: string }>
  | Readonly<{ token: string; email: string; password: string }>;

export type AcceptOrganizationInvitationSuccess = Readonly<{
  membership: OrganizationMember;
  user: { id: string; email: string };
  accessToken?: string;
  refreshToken?: string;
  invitationId: string;
}>;

export type AcceptOrganizationInvitationError =
  | { type: "invalid-token"; message: string }
  | { type: "expired-token"; message: string }
  | { type: "email-mismatch"; message: string }
  | { type: "email-already-exists"; message: string }
  | { type: "already-member"; message: string }
  | { type: "unauthenticated-user"; message: string }
  | { type: "invalid-password"; message: string };

export type AcceptOrganizationInvitationResult =
  | { success: true; data: AcceptOrganizationInvitationSuccess }
  | { success: false; error: AcceptOrganizationInvitationError };

type AcceptTransactionResult =
  | { type: "invalid-token" }
  | { type: "expired-token" }
  | { type: "email-mismatch" }
  | { type: "email-already-exists" }
  | { type: "already-member" }
  | { type: "unauthenticated-user" }
  | { type: "invalid-password"; message: string }
  | {
      type: "accepted";
      membership: OrganizationMember;
      user: { id: string; email: string };
      accessToken?: string;
      refreshToken?: string;
      invitationId: string;
    };

function mapTransactionError(
  result: Exclude<AcceptTransactionResult, { type: "accepted" }>,
): AcceptOrganizationInvitationError {
  switch (result.type) {
    case "invalid-token":
      return { type: "invalid-token", message: "無効な招待トークンです" };
    case "expired-token":
      return {
        type: "expired-token",
        message: "招待トークンの有効期限が切れています",
      };
    case "email-mismatch":
      return {
        type: "email-mismatch",
        message: "招待されたメールアドレスと一致しません",
      };
    case "email-already-exists":
      return {
        type: "email-already-exists",
        message: "指定されたメールアドレスは既に登録されています",
      };
    case "already-member":
      return {
        type: "already-member",
        message: "既に組織のメンバーです",
      };
    case "unauthenticated-user":
      return {
        type: "unauthenticated-user",
        message: "認証情報が無効です",
      };
    case "invalid-password":
      return {
        type: "invalid-password",
        message: result.message,
      };
  }
}

export async function acceptOrganizationInvitation(
  input: AcceptOrganizationInvitationInput,
  db: PrismaClient = prisma,
): Promise<AcceptOrganizationInvitationResult> {
  const tokenHash = hashInvitationToken(input.token);

  let transactionResult: AcceptTransactionResult;
  try {
    transactionResult = await db.$transaction(async (tx) => {
      const invitation = await findInvitationByTokenHash(tx, tokenHash);
      if (invitation === null) {
        return { type: "invalid-token" } as const;
      }
      if (invitation.expiresAt <= new Date()) {
        return { type: "expired-token" } as const;
      }

      let resolved:
        | ResolvedAcceptanceUser
        | Exclude<AcceptTransactionResult, { type: "accepted" }>;

      if ("authenticatedUserId" in input) {
        resolved = await resolveAuthenticatedAcceptanceUser(
          tx,
          input.authenticatedUserId,
          invitation.email,
        );
      } else {
        resolved = await resolveRegisteredAcceptanceUser(
          tx,
          input.email,
          input.password,
          invitation.email,
        );
      }

      if ("type" in resolved) {
        return resolved;
      }

      const canCreateMember = await ensureNotAlreadyMember(
        tx,
        invitation.organizationId,
        resolved.userId,
      );
      if (!canCreateMember) {
        return { type: "already-member" } as const;
      }

      const membership = await createMembershipAndDeleteInvitation(
        tx,
        invitation,
        resolved.userId,
      );

      return {
        type: "accepted",
        membership,
        user: { id: resolved.userId, email: resolved.userEmail },
        accessToken: resolved.accessToken,
        refreshToken: resolved.refreshToken,
        invitationId: invitation.id,
      } as const;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      if (
        isUniqueConstraintTarget(error, "organization_id") ||
        isUniqueConstraintTarget(error, "user_id")
      ) {
        return {
          success: false,
          error: { type: "already-member", message: "既に組織のメンバーです" },
        };
      }
      if (isUniqueConstraintTarget(error, "email")) {
        return {
          success: false,
          error: {
            type: "email-already-exists",
            message: "指定されたメールアドレスは既に登録されています",
          },
        };
      }
    }
    throw error;
  }

  if (transactionResult.type !== "accepted") {
    return {
      success: false,
      error: mapTransactionError(transactionResult),
    };
  }

  return {
    success: true,
    data: {
      membership: transactionResult.membership,
      user: transactionResult.user,
      accessToken: transactionResult.accessToken,
      refreshToken: transactionResult.refreshToken,
      invitationId: transactionResult.invitationId,
    },
  };
}

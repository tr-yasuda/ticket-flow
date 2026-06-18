import { Prisma, PrismaClient } from "@prisma/client";

import {
  AuditLog,
  AuditLogValues,
  createAuditLog,
} from "../domain/audit-log.js";
import {
  findAuditLogsByEntity as findAuditLogsByEntityInRepository,
  findAuditLogsByOrganizationId as findAuditLogsByOrganizationIdInRepository,
  saveAuditLog as saveAuditLogInRepository,
  type FindByEntityInput as RepositoryFindByEntityInput,
  type FindByOrganizationInput as RepositoryFindByOrganizationInput,
  type Pagination,
} from "../infrastructure/database/audit-log-repository.js";
import { prisma } from "../lib/prisma.js";

export type AuditLogServiceError =
  | { type: "organization-not-found"; message: string }
  | { type: "actor-not-found"; message: string }
  | { type: "invalid-payload"; message: string };

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: AuditLogServiceError };

export type SaveAuditLogInput = {
  organizationId: string;
  actorId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  oldValues?: AuditLogValues | null;
  newValues?: AuditLogValues | null;
};

function isPrismaClientKnownRequestError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

function mapPrismaError(
  error: Prisma.PrismaClientKnownRequestError,
): AuditLogServiceError {
  if (error.code === "P2003") {
    const field = error.meta?.field_name;
    if (
      field === "audit_logs_actor_id_fkey" ||
      field === "actor_id" ||
      field === "audit_logs_actorId_fkey"
    ) {
      return {
        type: "actor-not-found",
        message: "Related actor does not exist",
      };
    }
    return {
      type: "organization-not-found",
      message: "Related organization does not exist",
    };
  }
  throw error;
}

async function verifyActorExists(
  actorId: string,
  db: PrismaClient | Prisma.TransactionClient,
): Promise<boolean> {
  const actor = await db.user.findUnique({ where: { id: actorId } });
  return actor !== null;
}

export async function saveAuditLog(
  input: SaveAuditLogInput,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<ServiceResult<AuditLog>> {
  try {
    if (input.actorId !== null && input.actorId !== undefined) {
      const actorExists = await verifyActorExists(input.actorId, db);
      if (!actorExists) {
        return {
          success: false,
          error: {
            type: "actor-not-found",
            message: "Related actor does not exist",
          },
        };
      }
    }

    const auditLog = createAuditLog(input);
    const saved = await saveAuditLogInRepository(auditLog, db);
    return { success: true, data: saved };
  } catch (error) {
    if (error instanceof Error && error.message.includes("must")) {
      return {
        success: false,
        error: { type: "invalid-payload", message: error.message },
      };
    }
    if (isPrismaClientKnownRequestError(error)) {
      return { success: false, error: mapPrismaError(error) };
    }
    throw error;
  }
}

export type FindAuditLogsByOrganizationIdInput = {
  organizationId: string;
} & Pagination;

export async function findAuditLogsByOrganizationId(
  input: FindAuditLogsByOrganizationIdInput,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<ServiceResult<AuditLog[]>> {
  const repositoryInput: RepositoryFindByOrganizationInput = {
    organizationId: input.organizationId,
    take: input.take,
    skip: input.skip,
  };
  const logs = await findAuditLogsByOrganizationIdInRepository(
    repositoryInput,
    db,
  );
  return { success: true, data: logs };
}

export type FindAuditLogsByEntityInput = {
  organizationId: string;
  entityType: string;
  entityId: string;
} & Pagination;

export async function findAuditLogsByEntity(
  input: FindAuditLogsByEntityInput,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<ServiceResult<AuditLog[]>> {
  const repositoryInput: RepositoryFindByEntityInput = {
    organizationId: input.organizationId,
    entityType: input.entityType,
    entityId: input.entityId,
    take: input.take,
    skip: input.skip,
  };
  const logs = await findAuditLogsByEntityInRepository(repositoryInput, db);
  return { success: true, data: logs };
}

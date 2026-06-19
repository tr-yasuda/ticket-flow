import { Prisma, PrismaClient } from "@prisma/client";

import {
  AuditLog,
  AuditLogValues,
  rehydrateAuditLog,
} from "../../domain/audit-log.js";
import { prisma } from "../../lib/prisma.js";
import { resolveSkip, resolveTake, type Pagination } from "./pagination.js";

function toAuditLog(
  row: Prisma.AuditLogGetPayload<Record<string, never>>,
): AuditLog {
  return rehydrateAuditLog({
    id: row.id,
    organizationId: row.organizationId,
    actorId: row.actorId ?? null,
    entityType: row.entityType,
    entityId: row.entityId,
    action: row.action,
    oldValues: row.oldValues as AuditLogValues | null,
    newValues: row.newValues as AuditLogValues | null,
    createdAt: row.createdAt,
  });
}

export async function saveAuditLog(
  auditLog: AuditLog,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<AuditLog> {
  const row = await db.auditLog.create({
    data: {
      id: auditLog.id,
      organizationId: auditLog.organizationId,
      actorId: auditLog.actorId,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      action: auditLog.action,
      oldValues:
        auditLog.oldValues === null
          ? Prisma.DbNull
          : (auditLog.oldValues as Prisma.InputJsonValue),
      newValues:
        auditLog.newValues === null
          ? Prisma.DbNull
          : (auditLog.newValues as Prisma.InputJsonValue),
      createdAt: auditLog.createdAt,
    },
  });

  return toAuditLog(row);
}

export type FindByOrganizationInput = {
  organizationId: string;
} & Pagination;

export async function findAuditLogsByOrganizationId(
  input: FindByOrganizationInput,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<AuditLog[]> {
  const rows = await db.auditLog.findMany({
    where: { organizationId: input.organizationId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: resolveTake(input.take),
    skip: resolveSkip(input.skip),
  });

  return rows.map(toAuditLog);
}

export type FindByEntityInput = {
  organizationId: string;
  entityType: string;
  entityId: string;
} & Pagination;

export async function findAuditLogsByEntity(
  input: FindByEntityInput,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<AuditLog[]> {
  const rows = await db.auditLog.findMany({
    where: {
      organizationId: input.organizationId,
      entityType: input.entityType,
      entityId: input.entityId,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: resolveTake(input.take),
    skip: resolveSkip(input.skip),
  });

  return rows.map(toAuditLog);
}

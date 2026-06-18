import { Prisma, PrismaClient } from "@prisma/client";

import {
  AuditLog,
  AuditLogValues,
  rehydrateAuditLog,
} from "../../domain/audit-log.js";
import { prisma } from "../../lib/prisma.js";

export type Pagination = {
  take?: number;
  skip?: number;
};

const DEFAULT_TAKE = 100;
const MAX_TAKE = 1000;

function normalizeInteger(
  value: number | undefined,
  defaultValue: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return defaultValue;
  }
  return Math.trunc(value);
}

function resolveTake(inputTake: number | undefined): number {
  const requested = normalizeInteger(inputTake, DEFAULT_TAKE);
  return Math.min(Math.max(requested, 1), MAX_TAKE);
}

function resolveSkip(inputSkip: number | undefined): number {
  const requested = normalizeInteger(inputSkip, 0);
  return Math.max(requested, 0);
}

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

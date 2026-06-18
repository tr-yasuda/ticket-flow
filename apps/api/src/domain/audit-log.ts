import { randomUUID } from "node:crypto";

export type AuditLog = Readonly<{
  id: string;
  organizationId: string;
  actorId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  createdAt: Date;
}>;

export type AuditLogValues = Record<string, unknown>;

const MAX_ID_LENGTH = 200;
const MAX_ENTITY_TYPE_LENGTH = 100;
const MAX_ACTION_LENGTH = 100;
const MAX_JSON_BYTES = 65536;
const MAX_JSON_DEPTH = 10;

function isNonEmptyString(value: string): boolean {
  return value.trim().length > 0;
}

function isValidStringLength(value: string, maxLength: number): boolean {
  return value.length <= maxLength;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getJsonByteSize(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function getMaxDepth(value: unknown, currentDepth = 0): number {
  if (!isPlainObject(value) && !Array.isArray(value)) {
    return currentDepth;
  }

  const values = Array.isArray(value)
    ? value
    : Object.values(value as Record<string, unknown>);
  if (values.length === 0) {
    return currentDepth;
  }

  return 1 + Math.max(...values.map((v) => getMaxDepth(v, currentDepth)));
}

function hasCircularReference(
  value: unknown,
  seen = new WeakSet<object>(),
): boolean {
  if (!isPlainObject(value) && !Array.isArray(value)) {
    return false;
  }

  if (seen.has(value as object)) {
    return true;
  }
  seen.add(value as object);

  const values = Array.isArray(value)
    ? value
    : Object.values(value as Record<string, unknown>);
  return values.some((v) => hasCircularReference(v, seen));
}

function assertAuditLogValues(
  name: string,
  value: unknown,
): Record<string, unknown> | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!isPlainObject(value)) {
    throw new Error(`${name} must be a plain object or null`);
  }

  if (hasCircularReference(value)) {
    throw new Error(`${name} must not contain circular references`);
  }

  if (getMaxDepth(value) > MAX_JSON_DEPTH) {
    throw new Error(`${name} must not exceed ${MAX_JSON_DEPTH} levels deep`);
  }

  const byteSize = getJsonByteSize(value);
  if (byteSize > MAX_JSON_BYTES) {
    throw new Error(
      `${name} must not exceed ${MAX_JSON_BYTES} bytes when serialized`,
    );
  }

  return value;
}

export type CreateAuditLogInput = {
  organizationId: string;
  actorId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  oldValues?: AuditLogValues | null;
  newValues?: AuditLogValues | null;
};

type AuditLogFields = Omit<AuditLog, "id" | "createdAt"> & {
  id: string;
  createdAt: Date;
};

function validateAuditLog(fields: AuditLogFields): AuditLog {
  if (!isNonEmptyString(fields.id)) {
    throw new Error("id is required");
  }

  if (!isValidStringLength(fields.id, MAX_ID_LENGTH)) {
    throw new Error(`id must be ${MAX_ID_LENGTH} characters or fewer`);
  }

  if (!isNonEmptyString(fields.organizationId)) {
    throw new Error("organizationId is required");
  }

  if (!isValidStringLength(fields.organizationId, MAX_ID_LENGTH)) {
    throw new Error(
      `organizationId must be ${MAX_ID_LENGTH} characters or fewer`,
    );
  }

  if (
    fields.actorId !== null &&
    (!isNonEmptyString(fields.actorId) ||
      !isValidStringLength(fields.actorId, MAX_ID_LENGTH))
  ) {
    throw new Error(
      `actorId must be a non-empty string of ${MAX_ID_LENGTH} characters or fewer`,
    );
  }

  if (!isNonEmptyString(fields.entityType)) {
    throw new Error("entityType is required");
  }

  if (!isValidStringLength(fields.entityType, MAX_ENTITY_TYPE_LENGTH)) {
    throw new Error(
      `entityType must be ${MAX_ENTITY_TYPE_LENGTH} characters or fewer`,
    );
  }

  if (!isNonEmptyString(fields.entityId)) {
    throw new Error("entityId is required");
  }

  if (!isValidStringLength(fields.entityId, MAX_ID_LENGTH)) {
    throw new Error(`entityId must be ${MAX_ID_LENGTH} characters or fewer`);
  }

  if (!isNonEmptyString(fields.action)) {
    throw new Error("action is required");
  }

  if (!isValidStringLength(fields.action, MAX_ACTION_LENGTH)) {
    throw new Error(`action must be ${MAX_ACTION_LENGTH} characters or fewer`);
  }

  const oldValues = assertAuditLogValues("oldValues", fields.oldValues);
  const newValues = assertAuditLogValues("newValues", fields.newValues);

  return {
    id: fields.id,
    organizationId: fields.organizationId,
    actorId: fields.actorId ?? null,
    entityType: fields.entityType,
    entityId: fields.entityId,
    action: fields.action,
    oldValues,
    newValues,
    createdAt: fields.createdAt,
  };
}

export function createAuditLog(input: CreateAuditLogInput): AuditLog {
  return validateAuditLog({
    id: randomUUID(),
    organizationId: input.organizationId,
    actorId: input.actorId ?? null,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    oldValues: input.oldValues ?? null,
    newValues: input.newValues ?? null,
    createdAt: new Date(),
  });
}

export type RehydrateAuditLogInput = {
  id: string;
  organizationId: string;
  actorId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  oldValues: AuditLogValues | null;
  newValues: AuditLogValues | null;
  createdAt: Date;
};

export function rehydrateAuditLog(input: RehydrateAuditLogInput): AuditLog {
  return validateAuditLog(input);
}

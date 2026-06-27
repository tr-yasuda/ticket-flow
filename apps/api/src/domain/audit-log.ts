import { randomUUID } from "node:crypto";

import { z } from "zod";

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

export type AuditLogActor = Readonly<{
  id: string;
  name: string | null;
}>;

export type AuditLogWithActor = AuditLog & {
  actor: AuditLogActor | null;
};

export const AUDIT_LOG_ENTITY_TYPE_TICKET = "ticket";

export class AuditLogValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuditLogValidationError";
  }
}

const MAX_ID_LENGTH = 200;
const MAX_ENTITY_TYPE_LENGTH = 100;
const MAX_ACTION_LENGTH = 100;
const MAX_JSON_BYTES = 65536;
const MAX_JSON_DEPTH = 10;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function getJsonByteSize(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function getMaxDepth(value: unknown, currentDepth = 0): number {
  if (currentDepth > MAX_JSON_DEPTH) {
    return currentDepth;
  }

  if (!isPlainObject(value) && !Array.isArray(value)) {
    return currentDepth;
  }

  const values = Array.isArray(value)
    ? value
    : Object.values(value as Record<string, unknown>);
  if (values.length === 0) {
    return currentDepth;
  }

  let maxDepth = currentDepth;
  for (const child of values) {
    const childDepth = getMaxDepth(child, currentDepth + 1);
    if (childDepth > maxDepth) {
      maxDepth = childDepth;
    }
    if (maxDepth > MAX_JSON_DEPTH) {
      return maxDepth;
    }
  }

  return maxDepth;
}

function hasCircularReference(value: unknown, stack: unknown[] = []): boolean {
  if (stack.length > MAX_JSON_DEPTH) {
    return false;
  }

  if (!isPlainObject(value) && !Array.isArray(value)) {
    return false;
  }

  if (stack.includes(value as object)) {
    return true;
  }

  const nextStack = [...stack, value];
  const values = Array.isArray(value)
    ? value
    : Object.values(value as Record<string, unknown>);
  for (const child of values) {
    if (hasCircularReference(child, nextStack)) {
      return true;
    }
  }

  return false;
}

function createAuditLogValuesSchema(fieldName: string) {
  return z
    .custom<Record<string, unknown> | null>(
      (value) => value === null || isPlainObject(value),
      { message: `${fieldName} must be a plain object or null` },
    )
    .superRefine((value, ctx) => {
      if (value === null) {
        return;
      }

      if (hasCircularReference(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${fieldName} must not contain circular references`,
        });
        return;
      }

      if (getMaxDepth(value) > MAX_JSON_DEPTH) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${fieldName} must not exceed ${MAX_JSON_DEPTH} levels deep`,
        });
      }

      const byteSize = getJsonByteSize(value);
      if (byteSize > MAX_JSON_BYTES) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${fieldName} must not exceed ${MAX_JSON_BYTES} bytes when serialized`,
        });
      }
    });
}

function createIdSchema(fieldName: string) {
  return z
    .string({ message: `${fieldName} is required` })
    .min(1, { message: `${fieldName} is required` })
    .max(MAX_ID_LENGTH, {
      message: `${fieldName} must be ${MAX_ID_LENGTH} characters or fewer`,
    });
}

const actorIdSchema = z
  .string({
    message: `actorId must be a non-empty string of ${MAX_ID_LENGTH} characters or fewer`,
  })
  .min(1, {
    message: `actorId must be a non-empty string of ${MAX_ID_LENGTH} characters or fewer`,
  })
  .max(MAX_ID_LENGTH, {
    message: `actorId must be a non-empty string of ${MAX_ID_LENGTH} characters or fewer`,
  })
  .nullable();

const entityTypeSchema = z
  .string({ message: "entityType is required" })
  .min(1, { message: "entityType is required" })
  .max(MAX_ENTITY_TYPE_LENGTH, {
    message: `entityType must be ${MAX_ENTITY_TYPE_LENGTH} characters or fewer`,
  });

const actionSchema = z
  .string({ message: "action is required" })
  .min(1, { message: "action is required" })
  .max(MAX_ACTION_LENGTH, {
    message: `action must be ${MAX_ACTION_LENGTH} characters or fewer`,
  });

const auditLogSchema = z.object({
  id: createIdSchema("id"),
  organizationId: createIdSchema("organizationId"),
  actorId: actorIdSchema,
  entityType: entityTypeSchema,
  entityId: createIdSchema("entityId"),
  action: actionSchema,
  oldValues: createAuditLogValuesSchema("oldValues"),
  newValues: createAuditLogValuesSchema("newValues"),
  createdAt: z.date(),
});

export type CreateAuditLogInput = {
  organizationId: string;
  actorId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  oldValues?: AuditLogValues | null;
  newValues?: AuditLogValues | null;
};

const createAuditLogInputSchema = z.object({
  organizationId: createIdSchema("organizationId"),
  actorId: actorIdSchema.optional(),
  entityType: entityTypeSchema,
  entityId: createIdSchema("entityId"),
  action: actionSchema,
  oldValues: createAuditLogValuesSchema("oldValues").optional(),
  newValues: createAuditLogValuesSchema("newValues").optional(),
});

function mapZodError(error: z.ZodError): AuditLogValidationError {
  const issue = error.issues[0];
  if (issue === undefined) {
    return new AuditLogValidationError("Invalid input");
  }
  return new AuditLogValidationError(issue.message);
}

export function createAuditLog(input: CreateAuditLogInput): AuditLog {
  try {
    const parsed = createAuditLogInputSchema.parse({
      ...input,
      oldValues: input.oldValues ?? null,
      newValues: input.newValues ?? null,
    });

    return {
      ...parsed,
      id: randomUUID(),
      actorId: parsed.actorId ?? null,
      oldValues: parsed.oldValues ?? null,
      newValues: parsed.newValues ?? null,
      createdAt: new Date(),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw mapZodError(error);
    }
    throw error;
  }
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
  try {
    return auditLogSchema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw mapZodError(error);
    }
    throw error;
  }
}

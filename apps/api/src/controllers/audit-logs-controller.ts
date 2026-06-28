import { createApiPaginatedSuccessResponse } from "@ticket-flow/shared";
import type { Context } from "hono";

import type { AuditLogWithActor } from "../domain/audit-log.js";
import { HttpStatus } from "../lib/http-status.js";
import { listOrganizationAuditLogs } from "../services/audit-logs-service.js";
import { getRequiredContextValue } from "./context-helpers.js";
import { type ListOrganizationAuditLogsQuery } from "./schemas/audit-log-schema.js";

const SENSITIVE_FIELDS = new Set([
  "password",
  "token",
  "secret",
  "apiKey",
  "api_key",
  "refreshToken",
  "refresh_token",
  "accessToken",
  "access_token",
  "invitationToken",
  "invitation_token",
]);

function redactSensitiveValues(
  values: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (values === null) {
    return null;
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    redacted[key] = SENSITIVE_FIELDS.has(key) ? "***" : value;
  }

  return redacted;
}

function serializeAuditLog(log: AuditLogWithActor) {
  return {
    id: log.id,
    actor: log.actor,
    entityType: log.entityType,
    entityId: log.entityId,
    action: log.action,
    oldValues: redactSensitiveValues(log.oldValues),
    newValues: redactSensitiveValues(log.newValues),
    createdAt: log.createdAt.toISOString(),
  };
}

export async function listOrganizationAuditLogsController(
  c: Context,
): Promise<Response> {
  const organizationId = getRequiredContextValue(c, "organizationId");
  const { page, perPage } = c.req.valid(
    "query" as never,
  ) as ListOrganizationAuditLogsQuery;

  const skip = (page - 1) * perPage;

  const { logs, total } = await listOrganizationAuditLogs({
    organizationId,
    take: perPage,
    skip,
  });

  const totalPages = Math.ceil(total / perPage);

  return c.json(
    createApiPaginatedSuccessResponse(
      { auditLogs: logs.map(serializeAuditLog) },
      {
        page,
        perPage,
        total,
        totalPages,
      },
    ),
    HttpStatus.OK,
  );
}

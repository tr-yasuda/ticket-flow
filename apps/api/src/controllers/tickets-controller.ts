import {
  ApiErrorCode,
  createApiErrorResponse,
  createApiPaginatedSuccessResponse,
  createApiSuccessResponse,
  type ApiValidationErrorDetail,
} from "@ticket-flow/shared";
import type { Context } from "hono";

import { createAuditLog } from "../domain/audit-log.js";
import { saveAuditLog } from "../infrastructure/database/audit-log-repository.js";
import { HttpStatus } from "../lib/http-status.js";
import { getValidatedJson } from "../lib/validated-json.js";
import {
  createTicket,
  listTickets,
  type TicketServiceError,
} from "../services/ticket-service.js";
import {
  type CreateTicketBody,
  type ListTicketsQuery,
} from "./schemas/ticket-schema.js";

type ErrorMapping = Readonly<{
  code: ApiErrorCode;
  status:
    | typeof HttpStatus.BAD_REQUEST
    | typeof HttpStatus.INTERNAL_SERVER_ERROR;
  message: string;
  details?: ApiValidationErrorDetail[];
}>;

function mapCreateTicketError(error: TicketServiceError): ErrorMapping {
  switch (error.type) {
    case "validation-error":
      return {
        code: ApiErrorCode.VALIDATION_ERROR,
        status: HttpStatus.BAD_REQUEST,
        message: error.message,
      };
    case "user-not-organization-member":
      // organizationScopeMiddleware already verifies the creator's membership,
      // so this error in the controller path refers to the assignee.
      return {
        code: ApiErrorCode.VALIDATION_ERROR,
        status: HttpStatus.BAD_REQUEST,
        message: "担当者が組織のメンバーではありません",
        details: [
          {
            field: "assigneeId",
            message: "担当者は同じ組織のメンバーを指定してください",
          },
        ],
      };
    case "ticket-not-found":
    case "unknown-error":
    default:
      return {
        code: ApiErrorCode.INTERNAL_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: "サーバー内部でエラーが発生しました",
      };
  }
}

function mapListTicketsError(error: TicketServiceError): ErrorMapping {
  switch (error.type) {
    case "validation-error":
      return {
        code: ApiErrorCode.VALIDATION_ERROR,
        status: HttpStatus.BAD_REQUEST,
        message: error.message,
      };
    case "unknown-error":
    default:
      return {
        code: ApiErrorCode.INTERNAL_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: "サーバー内部でエラーが発生しました",
      };
  }
}

function getRequiredContextValue(
  c: Context,
  key: "organizationId" | "userId",
): string {
  const value = c.get(key);
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required context value: ${key}`);
  }
  return value;
}

async function recordTicketCreationAuditLog(
  organizationId: string,
  actorId: string,
  ticket: {
    id: string;
    title: string;
    description: string | null;
    priority: string;
    status: string;
    assigneeId: string | null;
  },
): Promise<void> {
  try {
    const auditLog = createAuditLog({
      organizationId,
      actorId,
      entityType: "ticket",
      entityId: ticket.id,
      action: "create",
      newValues: {
        title: ticket.title,
        description: ticket.description,
        priority: ticket.priority,
        status: ticket.status,
        assigneeId: ticket.assigneeId,
      },
    });
    await saveAuditLog(auditLog);
  } catch (error) {
    console.error("Failed to save audit log for ticket creation", {
      organizationId,
      entityId: ticket.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function createTicketController(c: Context) {
  const organizationId = getRequiredContextValue(c, "organizationId");
  const createdBy = getRequiredContextValue(c, "userId");
  const data = getValidatedJson<CreateTicketBody>(c);

  const result = await createTicket({
    organizationId,
    title: data.title,
    description: data.description ?? undefined,
    priority: data.priority,
    assigneeId: data.assigneeId ?? null,
    createdBy,
    skipCreatorMembershipCheck: true,
  });

  if (!result.success) {
    const { code, status, message, details } = mapCreateTicketError(
      result.error,
    );
    return c.json(createApiErrorResponse(code, message, details), status);
  }

  const { ticket } = result.data;
  await recordTicketCreationAuditLog(organizationId, createdBy, ticket);

  return c.json(createApiSuccessResponse(ticket), HttpStatus.CREATED);
}

export async function listTicketsController(c: Context) {
  const organizationId = getRequiredContextValue(c, "organizationId");
  const { page, perPage } = c.req.valid("query" as never) as ListTicketsQuery;

  const skip = (page - 1) * perPage;

  const result = await listTickets({
    organizationId,
    skip,
    take: perPage,
  });

  if (!result.success) {
    const { code, status, message, details } = mapListTicketsError(
      result.error,
    );
    return c.json(createApiErrorResponse(code, message, details), status);
  }

  const totalPages = Math.max(1, Math.ceil(result.data.total / perPage));

  return c.json(
    createApiPaginatedSuccessResponse(
      { tickets: result.data.tickets },
      {
        page,
        perPage,
        total: result.data.total,
        totalPages,
      },
    ),
    HttpStatus.OK,
  );
}

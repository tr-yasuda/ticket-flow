import {
  ApiErrorCode,
  createApiErrorResponse,
  createApiPaginatedSuccessResponse,
  createApiSuccessResponse,
} from "@ticket-flow/shared";
import type { Context } from "hono";

import {
  AUDIT_LOG_ENTITY_TYPE_TICKET,
  createAuditLog,
  type AuditLogWithActor,
} from "../domain/audit-log.js";
import type { Ticket, TicketListItem } from "../domain/ticket.js";
import {
  countAuditLogsByEntity,
  saveAuditLog,
} from "../infrastructure/database/audit-log-repository.js";
import { countCommentsByTicketId } from "../infrastructure/database/comment-repository.js";
import { HttpStatus } from "../lib/http-status.js";
import { getValidatedJson } from "../lib/validated-json.js";
import {
  createTicket,
  deleteTicket,
  getTicket,
  getTicketHistory,
  listTickets,
  updateTicket,
  updateTicketAssignee,
  updateTicketPriority,
  updateTicketStatus,
  type TicketServiceError,
} from "../services/ticket-service.js";
import { getRequiredContextValue } from "./context-helpers.js";
import { type ErrorMapping } from "./error-mapping.js";
import {
  type CreateTicketBody,
  type ListTicketHistoryQuery,
  type ListTicketsQuery,
  type TicketIdParamSchema,
  type UpdateTicketAssigneeBody,
  type UpdateTicketBody,
  type UpdateTicketPriorityBody,
  type UpdateTicketStatusBody,
} from "./schemas/ticket-schema.js";

function serializeTicket(ticket: Ticket, commentCount: number) {
  return {
    id: ticket.id,
    organizationId: ticket.organizationId,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    assigneeId: ticket.assigneeId,
    createdBy: ticket.createdBy,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    commentCount,
  };
}

function serializeTicketListItem(ticket: TicketListItem, commentCount: number) {
  return {
    id: ticket.id,
    organizationId: ticket.organizationId,
    title: ticket.title,
    status: ticket.status,
    priority: ticket.priority,
    assignee: ticket.assignee,
    createdBy: ticket.createdBy,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    commentCount,
  };
}

function serializeAuditLog(log: AuditLogWithActor) {
  return {
    id: log.id,
    actor: log.actor,
    action: log.action,
    oldValues: log.oldValues,
    newValues: log.newValues,
    createdAt: log.createdAt.toISOString(),
  };
}

function mapAssigneeMembershipValidationError(): ErrorMapping {
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
}

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
      return mapAssigneeMembershipValidationError();
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

  return c.json(
    createApiSuccessResponse(serializeTicket(ticket, 0)),
    HttpStatus.CREATED,
  );
}

export async function listTicketsController(c: Context) {
  const organizationId = getRequiredContextValue(c, "organizationId");
  const { page, perPage, search, status, assignee } = c.req.valid(
    "query" as never,
  ) as ListTicketsQuery;

  const skip = (page - 1) * perPage;

  const result = await listTickets({
    organizationId,
    skip,
    take: perPage,
    search,
    status,
    assigneeId: assignee,
  });

  if (!result.success) {
    const {
      code,
      status: httpStatus,
      message,
      details,
    } = mapListTicketsError(result.error);
    return c.json(createApiErrorResponse(code, message, details), httpStatus);
  }

  const totalPages = Math.max(1, Math.ceil(result.data.total / perPage));

  return c.json(
    createApiPaginatedSuccessResponse(
      {
        tickets: result.data.tickets.map((ticket) =>
          serializeTicketListItem(ticket, ticket.commentCount),
        ),
      },
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

function mapGetTicketError(error: TicketServiceError): {
  code: ApiErrorCode;
  status:
    | typeof HttpStatus.NOT_FOUND
    | typeof HttpStatus.BAD_REQUEST
    | typeof HttpStatus.FORBIDDEN
    | typeof HttpStatus.INTERNAL_SERVER_ERROR;
  message: string;
} {
  switch (error.type) {
    case "ticket-not-found":
      return {
        code: ApiErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        message: "チケットが見つかりません",
      };
    case "validation-error":
      return {
        code: ApiErrorCode.VALIDATION_ERROR,
        status: HttpStatus.BAD_REQUEST,
        message: error.message,
      };
    case "user-not-organization-member":
      return {
        code: ApiErrorCode.AUTH_FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
        message: "この組織にアクセスする権限がありません",
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

export async function getTicketController(c: Context) {
  const organizationId = getRequiredContextValue(c, "organizationId");
  const { ticketId } = c.req.valid("param" as never) as TicketIdParamSchema;

  const result = await getTicket({ organizationId, ticketId });

  if (!result.success) {
    const { code, status, message } = mapGetTicketError(result.error);
    return c.json(createApiErrorResponse(code, message), status);
  }

  const commentCount = await countCommentsByTicketId({
    organizationId,
    ticketId,
  });

  return c.json(
    createApiSuccessResponse(serializeTicket(result.data.ticket, commentCount)),
    HttpStatus.OK,
  );
}

export async function getTicketHistoryController(c: Context) {
  const organizationId = getRequiredContextValue(c, "organizationId");
  const { ticketId } = c.req.valid("param" as never) as TicketIdParamSchema;
  const { page, perPage } = c.req.valid(
    "query" as never,
  ) as ListTicketHistoryQuery;

  const skip = (page - 1) * perPage;

  const result = await getTicketHistory({
    organizationId,
    ticketId,
    take: perPage,
    skip,
  });

  if (!result.success) {
    const { code, status, message } = mapGetTicketError(result.error);
    return c.json(createApiErrorResponse(code, message), status);
  }

  const total = await countAuditLogsByEntity({
    organizationId,
    entityType: AUDIT_LOG_ENTITY_TYPE_TICKET,
    entityId: ticketId,
  });
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return c.json(
    createApiPaginatedSuccessResponse(
      { history: result.data.history.map(serializeAuditLog) },
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

function mapUpdateTicketError(error: TicketServiceError): ErrorMapping {
  switch (error.type) {
    case "ticket-not-found":
      return {
        code: ApiErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        message: "チケットが見つかりません",
      };
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

export async function updateTicketController(c: Context) {
  const organizationId = getRequiredContextValue(c, "organizationId");
  const updatedBy = getRequiredContextValue(c, "userId");
  const { ticketId } = c.req.valid("param" as never) as TicketIdParamSchema;
  const data = getValidatedJson<UpdateTicketBody>(c);

  const result = await updateTicket({
    organizationId,
    ticketId,
    updatedBy,
    title: data.title,
    description: data.description,
  });

  if (!result.success) {
    const { code, status, message, details } = mapUpdateTicketError(
      result.error,
    );
    return c.json(createApiErrorResponse(code, message, details), status);
  }

  const { ticket } = result.data;
  const commentCount = await countCommentsByTicketId({
    organizationId,
    ticketId,
  });

  return c.json(
    createApiSuccessResponse(serializeTicket(ticket, commentCount)),
    HttpStatus.OK,
  );
}

function mapUpdateTicketStatusError(error: TicketServiceError): ErrorMapping {
  switch (error.type) {
    case "ticket-not-found":
      return {
        code: ApiErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        message: "チケットが見つかりません",
      };
    case "ticket-conflict":
      return {
        code: ApiErrorCode.CONFLICT,
        status: HttpStatus.CONFLICT,
        message: error.message,
      };
    case "validation-error":
      return {
        code: ApiErrorCode.VALIDATION_ERROR,
        status: HttpStatus.BAD_REQUEST,
        message: error.message,
        details: [
          {
            field: "status",
            message: error.message,
          },
        ],
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

export async function updateTicketStatusController(c: Context) {
  const organizationId = getRequiredContextValue(c, "organizationId");
  const updatedBy = getRequiredContextValue(c, "userId");
  const { ticketId } = c.req.valid("param" as never) as TicketIdParamSchema;
  const data = getValidatedJson<UpdateTicketStatusBody>(c);

  const result = await updateTicketStatus({
    organizationId,
    ticketId,
    status: data.status,
    updatedBy,
  });

  if (!result.success) {
    const { code, status, message, details } = mapUpdateTicketStatusError(
      result.error,
    );
    return c.json(createApiErrorResponse(code, message, details), status);
  }

  const { ticket } = result.data;
  const commentCount = await countCommentsByTicketId({
    organizationId,
    ticketId,
  });

  return c.json(
    createApiSuccessResponse(serializeTicket(ticket, commentCount)),
    HttpStatus.OK,
  );
}

function mapUpdateTicketPriorityError(error: TicketServiceError): ErrorMapping {
  switch (error.type) {
    case "ticket-not-found":
      return {
        code: ApiErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        message: "チケットが見つかりません",
      };
    case "ticket-conflict":
      return {
        code: ApiErrorCode.CONFLICT,
        status: HttpStatus.CONFLICT,
        message: error.message,
      };
    case "validation-error":
      return {
        code: ApiErrorCode.VALIDATION_ERROR,
        status: HttpStatus.BAD_REQUEST,
        message: error.message,
        details: [
          {
            field: "priority",
            message: error.message,
          },
        ],
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

export async function updateTicketPriorityController(c: Context) {
  const organizationId = getRequiredContextValue(c, "organizationId");
  const updatedBy = getRequiredContextValue(c, "userId");
  const { ticketId } = c.req.valid("param" as never) as TicketIdParamSchema;
  const data = getValidatedJson<UpdateTicketPriorityBody>(c);

  const result = await updateTicketPriority({
    organizationId,
    ticketId,
    priority: data.priority,
    updatedBy,
  });

  if (!result.success) {
    const { code, status, message, details } = mapUpdateTicketPriorityError(
      result.error,
    );
    return c.json(createApiErrorResponse(code, message, details), status);
  }

  const { ticket } = result.data;
  const commentCount = await countCommentsByTicketId({
    organizationId,
    ticketId,
  });

  return c.json(
    createApiSuccessResponse(serializeTicket(ticket, commentCount)),
    HttpStatus.OK,
  );
}

function mapUpdateTicketAssigneeError(error: TicketServiceError): ErrorMapping {
  switch (error.type) {
    case "ticket-not-found":
      return {
        code: ApiErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        message: "チケットが見つかりません",
      };
    case "ticket-conflict":
      return {
        code: ApiErrorCode.CONFLICT,
        status: HttpStatus.CONFLICT,
        message: error.message,
      };
    case "user-not-organization-member":
      return mapAssigneeMembershipValidationError();
    case "validation-error":
      return {
        code: ApiErrorCode.VALIDATION_ERROR,
        status: HttpStatus.BAD_REQUEST,
        message: error.message,
        details: [
          {
            field: "assigneeId",
            message: error.message,
          },
        ],
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

export async function updateTicketAssigneeController(c: Context) {
  const organizationId = getRequiredContextValue(c, "organizationId");
  const updatedBy = getRequiredContextValue(c, "userId");
  const { ticketId } = c.req.valid("param" as never) as TicketIdParamSchema;
  const data = getValidatedJson<UpdateTicketAssigneeBody>(c);

  const result = await updateTicketAssignee({
    organizationId,
    ticketId,
    assigneeId: data.assigneeId,
    updatedBy,
  });

  if (!result.success) {
    const { code, status, message, details } = mapUpdateTicketAssigneeError(
      result.error,
    );
    return c.json(createApiErrorResponse(code, message, details), status);
  }

  const { ticket } = result.data;
  const commentCount = await countCommentsByTicketId({
    organizationId,
    ticketId,
  });

  return c.json(
    createApiSuccessResponse(serializeTicket(ticket, commentCount)),
    HttpStatus.OK,
  );
}

function mapDeleteTicketError(error: TicketServiceError): ErrorMapping {
  switch (error.type) {
    case "ticket-not-found":
      return {
        code: ApiErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        message: "チケットが見つかりません",
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

export async function deleteTicketController(c: Context) {
  const organizationId = getRequiredContextValue(c, "organizationId");
  const deletedBy = getRequiredContextValue(c, "userId");
  const { ticketId } = c.req.valid("param" as never) as TicketIdParamSchema;

  const result = await deleteTicket({
    organizationId,
    ticketId,
    deletedBy,
  });

  if (!result.success) {
    const { code, status, message } = mapDeleteTicketError(result.error);
    return c.json(createApiErrorResponse(code, message), status);
  }

  return c.body(null, HttpStatus.NO_CONTENT);
}

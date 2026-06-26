import {
  ApiErrorCode,
  createApiErrorResponse,
  createApiSuccessResponse,
} from "@ticket-flow/shared";
import type { Context } from "hono";

import { createAuditLog } from "../domain/audit-log.js";
import { saveAuditLog } from "../infrastructure/database/audit-log-repository.js";
import { HttpStatus } from "../lib/http-status.js";
import { getValidatedJson } from "../lib/validated-json.js";
import {
  createComment,
  type CommentServiceError,
} from "../services/comments-service.js";
import { getRequiredContextValue } from "./context-helpers.js";
import { type ErrorMapping } from "./error-mapping.js";
import { type CreateCommentBody } from "./schemas/comment-schema.js";
import { type TicketIdParamSchema } from "./schemas/ticket-schema.js";

function mapCreateCommentError(error: CommentServiceError): ErrorMapping {
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
    case "author-not-member":
      return {
        code: ApiErrorCode.AUTH_FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
        message: "この操作を行う権限がありません",
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

async function recordCommentCreationAuditLog(
  organizationId: string,
  actorId: string,
  comment: {
    id: string;
    ticketId: string;
    content: string;
  },
): Promise<void> {
  try {
    const auditLog = createAuditLog({
      organizationId,
      actorId,
      entityType: "comment",
      entityId: comment.id,
      action: "create",
      newValues: {
        ticketId: comment.ticketId,
        content: comment.content,
      },
    });
    await saveAuditLog(auditLog);
  } catch (error) {
    console.error("Failed to save audit log for comment creation", {
      organizationId,
      entityId: comment.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function createCommentController(c: Context) {
  const organizationId = getRequiredContextValue(c, "organizationId");
  const authorId = getRequiredContextValue(c, "userId");
  const { ticketId } = c.req.valid("param" as never) as TicketIdParamSchema;
  const data = getValidatedJson<CreateCommentBody>(c);

  const result = await createComment({
    organizationId,
    ticketId,
    authorId,
    content: data.content,
    skipAuthorMembershipCheck: true,
  });

  if (!result.success) {
    const { code, status, message, details } = mapCreateCommentError(
      result.error,
    );
    return c.json(createApiErrorResponse(code, message, details), status);
  }

  const { comment } = result.data;
  await recordCommentCreationAuditLog(organizationId, authorId, comment);

  return c.json(createApiSuccessResponse(comment), HttpStatus.CREATED);
}

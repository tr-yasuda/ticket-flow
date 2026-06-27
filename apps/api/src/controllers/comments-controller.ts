import {
  ApiErrorCode,
  createApiErrorResponse,
  createApiPaginatedSuccessResponse,
  createApiSuccessResponse,
} from "@ticket-flow/shared";
import type { Context } from "hono";

import { HttpStatus } from "../lib/http-status.js";
import { getValidatedJson } from "../lib/validated-json.js";
import {
  createComment,
  deleteComment,
  listCommentsByTicketId,
  updateComment,
  type CommentServiceError,
} from "../services/comments-service.js";
import { getRequiredContextValue } from "./context-helpers.js";
import { type ErrorMapping } from "./error-mapping.js";
import {
  type CreateCommentBody,
  type DeleteCommentParams,
  type ListCommentsQuery,
  type UpdateCommentBody,
  type UpdateCommentParams,
} from "./schemas/comment-schema.js";
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
    case "audit-log-error":
      return {
        code: ApiErrorCode.INTERNAL_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: "監査ログの保存に失敗しました",
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
  });

  if (!result.success) {
    const { code, status, message } = mapCreateCommentError(result.error);
    return c.json(createApiErrorResponse(code, message), status);
  }

  return c.json(
    createApiSuccessResponse(result.data.comment),
    HttpStatus.CREATED,
  );
}

function mapUpdateCommentError(error: CommentServiceError): ErrorMapping {
  switch (error.type) {
    case "ticket-not-found":
      return {
        code: ApiErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        message: "チケットが見つかりません",
      };
    case "comment-not-found":
      return {
        code: ApiErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        message: "コメントが見つかりません",
      };
    case "author-not-member":
      return {
        code: ApiErrorCode.AUTH_FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
        message: "この操作を行う権限がありません",
      };
    case "not-comment-author":
      return {
        code: ApiErrorCode.AUTH_FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
        message: "この操作を行う権限がありません",
      };
    case "validation-error":
      return {
        code: ApiErrorCode.VALIDATION_ERROR,
        status: HttpStatus.BAD_REQUEST,
        message: error.message,
      };
    case "audit-log-error":
      return {
        code: ApiErrorCode.INTERNAL_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: "監査ログの保存に失敗しました",
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

export async function updateCommentController(c: Context) {
  const organizationId = getRequiredContextValue(c, "organizationId");
  const actorId = getRequiredContextValue(c, "userId");
  const { ticketId, commentId } = c.req.valid(
    "param" as never,
  ) as UpdateCommentParams;
  const { content } = getValidatedJson<UpdateCommentBody>(c);

  const result = await updateComment({
    organizationId,
    ticketId,
    commentId,
    actorId,
    content,
  });

  if (!result.success) {
    const { code, status, message } = mapUpdateCommentError(result.error);
    return c.json(createApiErrorResponse(code, message), status);
  }

  return c.json(createApiSuccessResponse(result.data.comment), HttpStatus.OK);
}

function mapDeleteCommentError(error: CommentServiceError): ErrorMapping {
  switch (error.type) {
    case "ticket-not-found":
      return {
        code: ApiErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        message: "チケットが見つかりません",
      };
    case "comment-not-found":
      return {
        code: ApiErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        message: "コメントが見つかりません",
      };
    case "author-not-member":
    case "not-comment-author":
      return {
        code: ApiErrorCode.AUTH_FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
        message: "この操作を行う権限がありません",
      };
    case "validation-error":
      return {
        code: ApiErrorCode.VALIDATION_ERROR,
        status: HttpStatus.BAD_REQUEST,
        message: error.message,
      };
    case "audit-log-error":
      return {
        code: ApiErrorCode.INTERNAL_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: "監査ログの保存に失敗しました",
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

export async function deleteCommentController(c: Context) {
  const organizationId = getRequiredContextValue(c, "organizationId");
  const actorId = getRequiredContextValue(c, "userId");
  const { ticketId, commentId } = c.req.valid(
    "param" as never,
  ) as DeleteCommentParams;

  const result = await deleteComment({
    organizationId,
    ticketId,
    commentId,
    actorId,
  });

  if (!result.success) {
    const { code, status, message } = mapDeleteCommentError(result.error);
    return c.json(createApiErrorResponse(code, message), status);
  }

  return c.body(null, HttpStatus.NO_CONTENT);
}

function mapListCommentsError(error: CommentServiceError): ErrorMapping {
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

export async function listCommentsController(c: Context) {
  const organizationId = getRequiredContextValue(c, "organizationId");
  const { ticketId } = c.req.valid("param" as never) as TicketIdParamSchema;
  const { page, perPage } = c.req.valid("query" as never) as ListCommentsQuery;

  const skip = (page - 1) * perPage;

  const result = await listCommentsByTicketId({
    organizationId,
    ticketId,
    skip,
    take: perPage,
  });

  if (!result.success) {
    const { code, status, message } = mapListCommentsError(result.error);
    return c.json(createApiErrorResponse(code, message), status);
  }

  const totalPages = Math.max(1, Math.ceil(result.data.total / perPage));

  return c.json(
    createApiPaginatedSuccessResponse(
      { comments: result.data.comments },
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

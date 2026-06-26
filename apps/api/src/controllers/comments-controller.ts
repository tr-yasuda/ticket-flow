import {
  ApiErrorCode,
  createApiErrorResponse,
  createApiSuccessResponse,
} from "@ticket-flow/shared";
import type { Context } from "hono";

import { HttpStatus } from "../lib/http-status.js";
import { getValidatedJson } from "../lib/validated-json.js";
import {
  createComment,
  type CommentServiceError,
} from "../services/comments-service.js";
import { type CreateCommentBody } from "./schemas/comment-schema.js";
import { type GetTicketParamSchema } from "./schemas/ticket-schema.js";

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

function mapCreateCommentError(error: CommentServiceError): {
  code: ApiErrorCode;
  status:
    | typeof HttpStatus.BAD_REQUEST
    | typeof HttpStatus.NOT_FOUND
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
    case "author-not-member":
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

export async function createCommentController(c: Context) {
  const organizationId = getRequiredContextValue(c, "organizationId");
  const authorId = getRequiredContextValue(c, "userId");
  const { ticketId } = c.req.valid("param" as never) as GetTicketParamSchema;
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
    createApiSuccessResponse({ comment: result.data.comment }),
    HttpStatus.CREATED,
  );
}

import { Prisma, type PrismaClient } from "@prisma/client";
import { type CommentWithAuthor } from "@ticket-flow/shared";

import {
  COMMENT_AUDIT_ACTION_CREATE,
  COMMENT_AUDIT_ENTITY_TYPE,
  CommentValidationError,
  createComment as createCommentEntity,
} from "../domain/comment.js";
import { TicketNotFoundError } from "../domain/ticket.js";
import {
  countCommentsByTicketId,
  findCommentWithAuthorById,
  findCommentsWithAuthorByTicketId,
  saveComment,
} from "../infrastructure/database/comment-repository.js";
import { type Pagination } from "../infrastructure/database/pagination.js";
import { findTicketById } from "../infrastructure/database/ticket-repository.js";
import { prisma } from "../lib/prisma.js";
import { saveAuditLog } from "./audit-logs-service.js";

async function runInTransaction<T>(
  db: PrismaClient | Prisma.TransactionClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (
    "$transaction" in db &&
    typeof (db as PrismaClient).$transaction === "function"
  ) {
    return (db as PrismaClient).$transaction(fn);
  }

  return fn(db as Prisma.TransactionClient);
}

export class CommentAuthorNotMemberError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommentAuthorNotMemberError";
  }
}

export type CommentServiceError = Readonly<
  | { type: "ticket-not-found"; message: string }
  | { type: "author-not-member"; message: string }
  | { type: "validation-error"; message: string }
  | { type: "audit-log-error"; message: string }
  | { type: "unknown-error"; message: string }
>;

export type CreateCommentServiceInput = Readonly<{
  organizationId: string;
  ticketId: string;
  authorId: string;
  content: string;
}>;

export type CreateCommentResult =
  | { success: true; data: { comment: CommentWithAuthor } }
  | { success: false; error: CommentServiceError };

export async function createComment(
  input: CreateCommentServiceInput,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<CreateCommentResult> {
  try {
    const comment = createCommentEntity(input);

    const saved = await runInTransaction(db, async (tx) => {
      const ticket = await findTicketById(
        { organizationId: comment.organizationId, ticketId: comment.ticketId },
        tx,
      );
      if (ticket === null) {
        throw new TicketNotFoundError(
          `チケット ${comment.ticketId} が見つかりません`,
        );
      }

      const membership = await tx.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: comment.organizationId,
            userId: comment.authorId,
          },
        },
      });
      if (membership === null) {
        throw new CommentAuthorNotMemberError(
          `ユーザー ${comment.authorId} は組織 ${comment.organizationId} のメンバーではありません`,
        );
      }

      const savedComment = await saveComment(comment, tx);
      const commentWithAuthor = await findCommentWithAuthorById(
        { commentId: savedComment.id, organizationId: comment.organizationId },
        tx,
      );
      if (commentWithAuthor === null) {
        throw new Error(
          `作成したコメント ${savedComment.id} の取得に失敗しました`,
        );
      }

      const auditResult = await saveAuditLog(
        {
          organizationId: comment.organizationId,
          actorId: comment.authorId,
          entityType: COMMENT_AUDIT_ENTITY_TYPE,
          entityId: savedComment.id,
          action: COMMENT_AUDIT_ACTION_CREATE,
          newValues: {
            ticketId: savedComment.ticketId,
            content: savedComment.content,
          },
        },
        tx,
      );
      if (!auditResult.success) {
        throw new AuditLogError(auditResult.error.message);
      }

      return commentWithAuthor;
    });

    return { success: true, data: { comment: saved } };
  } catch (error) {
    return mapServiceError(error);
  }
}

class AuditLogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuditLogError";
  }
}

export type ListCommentsByTicketIdInput = Readonly<
  {
    organizationId: string;
    ticketId: string;
  } & Pagination
>;

export type ListCommentsByTicketIdResult =
  | {
      success: true;
      data: { comments: readonly CommentWithAuthor[]; total: number };
    }
  | { success: false; error: CommentServiceError };

export async function listCommentsByTicketId(
  input: ListCommentsByTicketIdInput,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<ListCommentsByTicketIdResult> {
  try {
    const ticket = await findTicketById(
      { organizationId: input.organizationId, ticketId: input.ticketId },
      db,
    );
    if (ticket === null) {
      throw new TicketNotFoundError(
        `チケット ${input.ticketId} が見つかりません`,
      );
    }

    const [comments, total] = await Promise.all([
      findCommentsWithAuthorByTicketId(input, db),
      countCommentsByTicketId(
        {
          organizationId: input.organizationId,
          ticketId: input.ticketId,
        },
        db,
      ),
    ]);

    return { success: true, data: { comments, total } };
  } catch (error) {
    return mapServiceError(error);
  }
}

function mapServiceError(error: unknown): {
  success: false;
  error: CommentServiceError;
} {
  if (error instanceof TicketNotFoundError) {
    return {
      success: false,
      error: { type: "ticket-not-found", message: error.message },
    };
  }

  if (error instanceof CommentAuthorNotMemberError) {
    return {
      success: false,
      error: { type: "author-not-member", message: error.message },
    };
  }

  if (error instanceof CommentValidationError) {
    return {
      success: false,
      error: { type: "validation-error", message: error.message },
    };
  }

  if (error instanceof AuditLogError) {
    return {
      success: false,
      error: { type: "audit-log-error", message: error.message },
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    console.error("Prisma error:", error);
    return {
      success: false,
      error: {
        type: "unknown-error",
        message: "データベースエラーが発生しました",
      },
    };
  }

  if (error instanceof Error) {
    console.error("Unexpected error:", error);
    return {
      success: false,
      error: { type: "unknown-error", message: error.message },
    };
  }

  return {
    success: false,
    error: { type: "unknown-error", message: "不明なエラーが発生しました" },
  };
}

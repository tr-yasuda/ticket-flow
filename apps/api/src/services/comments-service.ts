import { Prisma, type PrismaClient } from "@prisma/client";

import {
  CommentValidationError,
  createComment as createCommentEntity,
  type Comment,
} from "../domain/comment.js";
import { TicketNotFoundError } from "../domain/ticket.js";
import {
  countCommentsByTicketId,
  findCommentsByTicketId,
  saveComment,
  type FindCommentsByTicketIdInput,
} from "../infrastructure/database/comment-repository.js";
import { type Pagination } from "../infrastructure/database/pagination.js";
import { findTicketById } from "../infrastructure/database/ticket-repository.js";
import { prisma } from "../lib/prisma.js";

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
  | { type: "unknown-error"; message: string }
>;

export type CreateCommentServiceInput = Readonly<{
  organizationId: string;
  ticketId: string;
  authorId: string;
  content: string;
  skipAuthorMembershipCheck?: boolean;
}>;

export type CreateCommentResult =
  | { success: true; data: { comment: Comment } }
  | { success: false; error: CommentServiceError };

export async function createComment(
  input: CreateCommentServiceInput,
  db: PrismaClient = prisma,
): Promise<CreateCommentResult> {
  try {
    const comment = createCommentEntity(input);

    const saved = await db.$transaction(async (tx) => {
      const ticket = await findTicketById(
        { organizationId: comment.organizationId, ticketId: comment.ticketId },
        tx,
      );
      if (ticket === null) {
        throw new TicketNotFoundError(
          `チケット ${comment.ticketId} が見つかりません`,
        );
      }

      if (input.skipAuthorMembershipCheck !== true) {
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
      }

      return saveComment(comment, tx);
    });

    return { success: true, data: { comment: saved } };
  } catch (error) {
    return mapServiceError(error);
  }
}

export type ListCommentsByTicketIdInput = Readonly<{
  organizationId: string;
  ticketId: string;
}> &
  Pagination;

export type ListCommentsByTicketIdResult =
  | { success: true; data: { comments: readonly Comment[]; total: number } }
  | { success: false; error: CommentServiceError };

export async function listCommentsByTicketId(
  input: ListCommentsByTicketIdInput,
  db: PrismaClient = prisma,
): Promise<ListCommentsByTicketIdResult> {
  try {
    const result = await db.$transaction(async (tx) => {
      const ticket = await findTicketById(
        { organizationId: input.organizationId, ticketId: input.ticketId },
        tx,
      );
      if (ticket === null) {
        throw new TicketNotFoundError(
          `チケット ${input.ticketId} が見つかりません`,
        );
      }

      const repositoryInput: FindCommentsByTicketIdInput = {
        organizationId: input.organizationId,
        ticketId: input.ticketId,
        take: input.take,
        skip: input.skip,
      };

      const [comments, total] = await Promise.all([
        findCommentsByTicketId(repositoryInput, tx),
        countCommentsByTicketId(
          {
            organizationId: input.organizationId,
            ticketId: input.ticketId,
          },
          tx,
        ),
      ]);

      return { comments, total };
    });

    return { success: true, data: result };
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
  }

  return {
    success: false,
    error: { type: "unknown-error", message: "不明なエラーが発生しました" },
  };
}

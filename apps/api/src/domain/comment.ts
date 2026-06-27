import { randomUUID } from "node:crypto";

import {
  commentAuthorIdSchema,
  commentContentSchema,
  commentOrganizationIdSchema,
  commentTicketIdSchema,
  createCommentInputSchema,
} from "@ticket-flow/shared";
import { z } from "zod";
export type CommentId = string;

export type Comment = Readonly<{
  id: CommentId;
  ticketId: string;
  organizationId: string;
  authorId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}>;

export const COMMENT_AUDIT_ENTITY_TYPE = "comment";
export const COMMENT_AUDIT_ACTION_CREATE = "create";
export const COMMENT_AUDIT_ACTION_UPDATE = "update";

export class CommentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommentValidationError";
  }
}

export class CommentNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommentNotFoundError";
  }
}

export class CommentForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommentForbiddenError";
  }
}

const commentSchema = z.object({
  id: z
    .string({ message: "コメントIDは必須です" })
    .min(1, "コメントIDは必須です"),
  ticketId: commentTicketIdSchema,
  organizationId: commentOrganizationIdSchema,
  authorId: commentAuthorIdSchema,
  content: commentContentSchema,
  createdAt: z.date({ message: "作成日時は必須です" }),
  updatedAt: z.date({ message: "更新日時は必須です" }),
});

function parseWith<T>(schema: z.ZodType<T>, input: unknown): T {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstIssue = error.issues[0];
      throw new CommentValidationError(
        firstIssue?.message ?? "入力内容を確認してください",
      );
    }
    throw error;
  }
}

export type CreateCommentInput = Readonly<{
  ticketId: string;
  organizationId: string;
  authorId: string;
  content: string;
}>;

export function createComment(input: CreateCommentInput): Comment {
  const parsed = parseWith(createCommentInputSchema, input);
  const now = new Date();

  return parseWith(commentSchema, {
    id: randomUUID(),
    ticketId: parsed.ticketId,
    organizationId: parsed.organizationId,
    authorId: parsed.authorId,
    content: parsed.content,
    createdAt: now,
    updatedAt: now,
  });
}

export function validateCommentContent(content: string): string {
  return parseWith(commentContentSchema, content);
}

export function updateCommentContent(
  comment: Comment,
  content: string,
): Comment {
  const parsedContent = validateCommentContent(content);

  return parseWith(commentSchema, {
    ...comment,
    content: parsedContent,
    updatedAt: new Date(),
  });
}

export type RehydrateCommentInput = Readonly<{
  id: CommentId;
  ticketId: string;
  organizationId: string;
  authorId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}>;

export function rehydrateComment(input: RehydrateCommentInput): Comment {
  return parseWith(commentSchema, input);
}

import {
  Prisma,
  PrismaClient,
  type Comment as PrismaComment,
} from "@prisma/client";
import { type CommentWithAuthor } from "@ticket-flow/shared";

import { type Comment, rehydrateComment } from "../../domain/comment.js";
import { prisma } from "../../lib/prisma.js";
import { resolveSkip, resolveTake, type Pagination } from "./pagination.js";

function toComment(
  row: Prisma.CommentGetPayload<Record<string, never>>,
): Comment {
  return rehydrateComment({
    id: row.id,
    ticketId: row.ticketId,
    organizationId: row.organizationId,
    authorId: row.authorId,
    content: row.content,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function toCommentWithAuthor(
  row: PrismaComment & {
    author: { id: string; name: string | null; email: string };
  },
): CommentWithAuthor {
  return {
    id: row.id,
    ticketId: row.ticketId,
    organizationId: row.organizationId,
    content: row.content,
    author: {
      id: row.author.id,
      name: row.author.name,
      email: row.author.email,
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function saveComment(
  comment: Comment,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<Comment> {
  const row = await db.comment.create({
    data: {
      id: comment.id,
      ticketId: comment.ticketId,
      organizationId: comment.organizationId,
      authorId: comment.authorId,
      content: comment.content,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    },
  });

  return toComment(row);
}

export type CountCommentsByTicketIdInput = Readonly<{
  organizationId: string;
  ticketId: string;
}>;

export async function countCommentsByTicketId(
  input: CountCommentsByTicketIdInput,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<number> {
  return db.comment.count({
    where: {
      organizationId: input.organizationId,
      ticketId: input.ticketId,
    },
  });
}

export type FindCommentsWithAuthorByTicketIdInput = Readonly<{
  organizationId: string;
  ticketId: string;
}> &
  Pagination;

export async function findCommentsWithAuthorByTicketId(
  input: FindCommentsWithAuthorByTicketIdInput,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<CommentWithAuthor[]> {
  const rows = await db.comment.findMany({
    where: {
      organizationId: input.organizationId,
      ticketId: input.ticketId,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: {
      author: {
        select: { id: true, name: true, email: true },
      },
    },
    take: resolveTake(input.take),
    skip: resolveSkip(input.skip),
  });

  return rows.map(toCommentWithAuthor);
}

export async function findCommentWithAuthorById(
  commentId: string,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<CommentWithAuthor | null> {
  const row = await db.comment.findUnique({
    where: { id: commentId },
    include: {
      author: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (row === null) {
    return null;
  }

  return toCommentWithAuthor(row);
}

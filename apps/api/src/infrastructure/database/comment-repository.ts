import { Prisma, PrismaClient } from "@prisma/client";

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

export type FindCommentsByTicketIdInput = Readonly<{
  organizationId: string;
  ticketId: string;
}> &
  Pagination;

export async function findCommentsByTicketId(
  input: FindCommentsByTicketIdInput,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<Comment[]> {
  const rows = await db.comment.findMany({
    where: {
      organizationId: input.organizationId,
      ticketId: input.ticketId,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: resolveTake(input.take),
    skip: resolveSkip(input.skip),
  });

  return rows.map(toComment);
}

export async function countCommentsByTicketId(
  input: Omit<FindCommentsByTicketIdInput, "take" | "skip">,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<number> {
  return db.comment.count({
    where: {
      organizationId: input.organizationId,
      ticketId: input.ticketId,
    },
  });
}

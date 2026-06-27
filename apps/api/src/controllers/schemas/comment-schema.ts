import { commentContentSchema } from "@ticket-flow/shared";
import { z } from "zod";

import { MAX_SKIP } from "../../infrastructure/database/pagination.js";
import { ticketIdParamSchema } from "./ticket-schema.js";

export const createCommentBodySchema = z.object({
  content: commentContentSchema,
});

export type CreateCommentBody = z.infer<typeof createCommentBodySchema>;

export const updateCommentBodySchema = z.object({
  content: commentContentSchema,
});

export type UpdateCommentBody = z.infer<typeof updateCommentBodySchema>;

export const updateCommentParamsSchema = ticketIdParamSchema.extend({
  commentId: z
    .string()
    .uuid({ message: "コメントIDの形式が正しくありません" })
    .transform((value) => value.toLowerCase()),
});

export type UpdateCommentParams = z.infer<typeof updateCommentParamsSchema>;

export const deleteCommentParamsSchema = updateCommentParamsSchema;

export type DeleteCommentParams = z.infer<typeof deleteCommentParamsSchema>;

export const listCommentsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine((data) => (data.page - 1) * data.perPage <= MAX_SKIP, {
    message: "ページ範囲が大きすぎます",
    path: ["page"],
  });

export type ListCommentsQuery = z.infer<typeof listCommentsQuerySchema>;

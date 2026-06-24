import {
  ticketDescriptionSchema,
  ticketPrioritySchema,
  ticketTitleSchema,
} from "@ticket-flow/shared";
import { z } from "zod";

import { MAX_SKIP } from "../../infrastructure/database/pagination.js";

export const createTicketBodySchema = z.object({
  title: ticketTitleSchema,
  description: ticketDescriptionSchema,
  priority: ticketPrioritySchema.optional(),
  assigneeId: z
    .string()
    .uuid({ message: "担当者IDの形式が正しくありません" })
    .nullable()
    .optional(),
});

export type CreateTicketBody = z.infer<typeof createTicketBodySchema>;

export const listTicketsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine((data) => (data.page - 1) * data.perPage <= MAX_SKIP, {
    message: "ページ範囲が大きすぎます",
    path: ["page"],
  });

export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;

export const getTicketParamSchema = z.object({
  ticketId: z
    .string()
    .uuid({ message: "チケットIDの形式が正しくありません" })
    .transform((value) => value.toLowerCase()),
});

export type GetTicketParamSchema = z.infer<typeof getTicketParamSchema>;

export const updateTicketBodySchema = z
  .object({
    title: ticketTitleSchema.optional(),
    description: ticketDescriptionSchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.title === undefined && data.description === undefined) {
      for (const field of ["title", "description"] as const) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "更新する項目を指定してください",
          path: [field],
        });
      }
    }
  });

export type UpdateTicketBody = z.infer<typeof updateTicketBodySchema>;

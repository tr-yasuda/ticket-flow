import {
  ticketDescriptionSchema,
  ticketPrioritySchema,
  ticketTitleSchema,
  updateTicketStatusInputSchema,
} from "@ticket-flow/shared";
import { z } from "zod";

import { MAX_SKIP } from "../../infrastructure/database/pagination.js";

export const MAX_TICKET_SEARCH_LENGTH = 100;

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
    search: z
      .string()
      .max(MAX_TICKET_SEARCH_LENGTH, {
        message: `検索キーワードは${MAX_TICKET_SEARCH_LENGTH}文字以内で入力してください`,
      })
      .optional(),
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

const allowedUpdateTicketKeys = new Set(["title", "description"]);

export const updateTicketBodySchema = z
  .object({
    title: ticketTitleSchema.optional(),
    description: ticketDescriptionSchema,
  })
  .passthrough()
  .superRefine((data, ctx) => {
    for (const key of Object.keys(data)) {
      if (!allowedUpdateTicketKeys.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "許可されていないフィールドです",
          path: [key],
        });
      }
    }

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

export type UpdateTicketBody = {
  title?: string;
  description?: string | null;
};

export const updateTicketStatusBodySchema = updateTicketStatusInputSchema
  .passthrough()
  .superRefine((data, ctx) => {
    for (const key of Object.keys(data)) {
      if (key !== "status") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "許可されていないフィールドです",
          path: [key],
        });
      }
    }
  })
  .transform((data) => ({ status: data.status }));

export type UpdateTicketStatusBody = z.infer<
  typeof updateTicketStatusBodySchema
>;

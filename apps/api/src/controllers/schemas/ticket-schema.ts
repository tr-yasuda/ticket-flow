import {
  ticketDescriptionSchema,
  ticketPrioritySchema,
  ticketStatusSchema,
  ticketTitleSchema,
  updateTicketAssigneeInputSchema,
  updateTicketPriorityInputSchema,
  updateTicketStatusInputSchema,
} from "@ticket-flow/shared";
import { z } from "zod";

import { MAX_SKIP } from "../../infrastructure/database/pagination.js";

export const MAX_TICKET_SEARCH_LENGTH = 100;
const MAX_FILTER_STRING_LENGTH = 100;
const MAX_FILTER_ARRAY_LENGTH = 10;

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

function parseEnumQuery<T extends string>(
  allowedValues: readonly T[],
  value: string | string[] | undefined,
): T[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  const rawValues = Array.isArray(value) ? value : value.split(",");
  const validValues = rawValues
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .filter((item): item is T => allowedValues.includes(item as T));

  if (validValues.length === 0) {
    return undefined;
  }

  return [...new Set(validValues)];
}

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
    // NOTE: status / priority はドメイン enum と同じ小文字値で一致させ、
    // 大文字・無効値は無視する。無効値のみの場合はフィルタが解除される。
    status: z
      .union([
        z.string().max(MAX_FILTER_STRING_LENGTH),
        z
          .array(z.string().max(MAX_FILTER_STRING_LENGTH))
          .max(MAX_FILTER_ARRAY_LENGTH),
      ])
      .optional()
      .transform((value) => parseEnumQuery(ticketStatusSchema.options, value)),
    priority: z
      .union([
        z.string().max(MAX_FILTER_STRING_LENGTH),
        z
          .array(z.string().max(MAX_FILTER_STRING_LENGTH))
          .max(MAX_FILTER_ARRAY_LENGTH),
      ])
      .optional()
      .transform((value) =>
        parseEnumQuery(ticketPrioritySchema.options, value),
      ),
    assignee: z
      .preprocess(
        (value) =>
          typeof value === "string" ? value.trim().toLowerCase() : value,
        z
          .union([
            z.literal("none"),
            z.string().uuid({ message: "担当者IDの形式が正しくありません" }),
          ])
          .optional(),
      )
      .transform((value) => (value === "none" ? null : value)),
  })
  .refine((data) => (data.page - 1) * data.perPage <= MAX_SKIP, {
    message: "ページ範囲が大きすぎます",
    path: ["page"],
  });

export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;

export const listTicketHistoryQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine((data) => (data.page - 1) * data.perPage <= MAX_SKIP, {
    message: "ページ範囲が大きすぎます",
    path: ["page"],
  });

export type ListTicketHistoryQuery = z.infer<
  typeof listTicketHistoryQuerySchema
>;

export const ticketIdParamSchema = z.object({
  ticketId: z
    .string()
    .uuid({ message: "チケットIDの形式が正しくありません" })
    .transform((value) => value.toLowerCase()),
});

export type TicketIdParamSchema = z.infer<typeof ticketIdParamSchema>;

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

function createSingleFieldBodySchema<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  allowedField: keyof T & string,
) {
  return schema.passthrough().superRefine((data, ctx) => {
    for (const key of Object.keys(data)) {
      if (key !== allowedField) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "許可されていないフィールドです",
          path: [key],
        });
      }
    }
  });
}

export const updateTicketStatusBodySchema = createSingleFieldBodySchema(
  updateTicketStatusInputSchema,
  "status",
);

export type UpdateTicketStatusBody = z.infer<
  typeof updateTicketStatusBodySchema
>;

export const updateTicketPriorityBodySchema = createSingleFieldBodySchema(
  updateTicketPriorityInputSchema,
  "priority",
);

export type UpdateTicketPriorityBody = z.infer<
  typeof updateTicketPriorityBodySchema
>;

export const updateTicketAssigneeBodySchema = createSingleFieldBodySchema(
  updateTicketAssigneeInputSchema,
  "assigneeId",
);

export type UpdateTicketAssigneeBody = z.infer<
  typeof updateTicketAssigneeBodySchema
>;

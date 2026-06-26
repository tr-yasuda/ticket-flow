import { z } from "zod";

const MAX_TICKET_TITLE_LENGTH = 200;
const MAX_TICKET_DESCRIPTION_LENGTH = 10000;

function trim(value: string): string {
  return value.trim();
}

export const ticketTitleSchema = z
  .string({ message: "タイトルを入力してください" })
  .min(1, "タイトルを入力してください")
  .transform(trim)
  .refine((value) => value.length > 0, "タイトルを入力してください")
  .refine(
    (value) => value.length <= MAX_TICKET_TITLE_LENGTH,
    `タイトルは${MAX_TICKET_TITLE_LENGTH}文字以内で入力してください`,
  );

export const ticketDescriptionSchema = z
  .string()
  .transform(trim)
  .refine(
    (value) => value.length <= MAX_TICKET_DESCRIPTION_LENGTH,
    `説明は${MAX_TICKET_DESCRIPTION_LENGTH}文字以内で入力してください`,
  )
  .transform((value) => (value.length > 0 ? value : null))
  .nullable()
  .optional();

export const ticketStatusSchema = z.enum(["open", "in-progress", "closed"], {
  message: "ステータスの値が正しくありません",
});

export const ticketPrioritySchema = z.enum(
  ["low", "medium", "high", "urgent"],
  {
    message: "優先度の値が正しくありません",
  },
);

export const ticketOrganizationIdSchema = z
  .string({ message: "組織IDを入力してください" })
  .min(1, "組織IDを入力してください")
  .transform(trim)
  .refine((value) => value.length > 0, "組織IDを入力してください");

export const ticketCreatedBySchema = z
  .string({ message: "作成者IDを入力してください" })
  .min(1, "作成者IDを入力してください")
  .transform(trim)
  .refine((value) => value.length > 0, "作成者IDを入力してください");

// ドメイン層用: 空文字・null・undefined の正規化のみを行う。
// UUID 形式の検証は行わない。
export const ticketAssigneeIdSchema = z
  .string()
  .transform(trim)
  .refine(
    (value) => value.length > 0,
    "担当者IDは空文字でない文字列である必要があります",
  )
  .nullable()
  .optional();

export const createTicketInputSchema = z.object({
  title: ticketTitleSchema,
  organizationId: ticketOrganizationIdSchema,
  createdBy: ticketCreatedBySchema,
  description: ticketDescriptionSchema,
  priority: ticketPrioritySchema.optional(),
  assigneeId: ticketAssigneeIdSchema,
});

export const updateTicketStatusInputSchema = z.object({
  status: ticketStatusSchema,
});

export const updateTicketPriorityInputSchema = z.object({
  priority: ticketPrioritySchema,
});

// API 境界用: 担当者IDは有効な UUID、または null（担当者解除）であることを要求する。
// ドメイン層の ticketAssigneeIdSchema とは役割が異なる。
export const updateTicketAssigneeInputSchema = z.object({
  assigneeId: z
    .string()
    .uuid({ message: "担当者IDの形式が正しくありません" })
    .nullable(),
});

export const updateTicketInputSchema = z.object({
  title: ticketTitleSchema.optional(),
  description: ticketDescriptionSchema,
  priority: ticketPrioritySchema.optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketInputSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketInputSchema>;
export type UpdateTicketStatusInput = z.infer<
  typeof updateTicketStatusInputSchema
>;
export type UpdateTicketPriorityInput = z.infer<
  typeof updateTicketPriorityInputSchema
>;
export type UpdateTicketAssigneeInput = z.infer<
  typeof updateTicketAssigneeInputSchema
>;

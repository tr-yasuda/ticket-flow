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

// ドメイン層用: null・undefined を許容し、空文字は拒否する。
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
  status: ticketStatusSchema.optional(),
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

export const updateTicketInputSchema = z
  .object({
    title: ticketTitleSchema.optional(),
    description: ticketDescriptionSchema,
    priority: ticketPrioritySchema.optional(),
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.description !== undefined ||
      data.priority !== undefined,
    {
      message: "更新する項目を指定してください",
    },
  );

export const ticketAssigneeSchema = z.union([
  z.object({
    id: z.string().min(1, "担当者IDは空文字でない文字列である必要があります"),
    name: z.string().nullable(),
  }),
  z.null(),
]);

const isoDateTimeStringSchema = z.string().datetime();

export const ticketListItemResponseSchema = z
  .object({
    id: z.string().min(1, "チケットIDは空文字でない文字列である必要があります"),
    organizationId: z
      .string()
      .min(1, "組織IDは空文字でない文字列である必要があります"),
    title: z
      .string()
      .min(1, "タイトルは空文字でない文字列である必要があります"),
    status: ticketStatusSchema,
    priority: ticketPrioritySchema,
    assignee: ticketAssigneeSchema,
    createdBy: z
      .string()
      .min(1, "作成者IDは空文字でない文字列である必要があります"),
    createdAt: isoDateTimeStringSchema,
    updatedAt: isoDateTimeStringSchema,
    commentCount: z.number().int().nonnegative(),
  })
  .transform((data) => ({
    ...data,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  }));

export type TicketListItemResponse = z.infer<
  typeof ticketListItemResponseSchema
>;

export const ticketDetailResponseSchema = z.object({
  id: z.string().min(1, "チケットIDは空文字でない文字列である必要があります"),
  organizationId: z
    .string()
    .min(1, "組織IDは空文字でない文字列である必要があります"),
  title: z.string().min(1, "タイトルは空文字でない文字列である必要があります"),
  description: z.string().nullable(),
  status: ticketStatusSchema,
  priority: ticketPrioritySchema,
  createdBy: z
    .string()
    .min(1, "作成者IDは空文字でない文字列である必要があります"),
  createdAt: isoDateTimeStringSchema,
  updatedAt: isoDateTimeStringSchema,
  commentCount: z.number().int().nonnegative(),
  assigneeId: z
    .string()
    .min(1, "担当者IDは空文字でない文字列である必要があります")
    .nullable(),
});

export type TicketDetailResponse = z.infer<typeof ticketDetailResponseSchema>;

export const ticketDetailSchema = ticketDetailResponseSchema.transform(
  (data) => ({
    id: data.id,
    organizationId: data.organizationId,
    title: data.title,
    description: data.description,
    status: data.status,
    priority: data.priority,
    assigneeId: data.assigneeId,
    createdBy: data.createdBy,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
    commentCount: data.commentCount,
  }),
);

export type TicketDetail = z.infer<typeof ticketDetailSchema>;

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

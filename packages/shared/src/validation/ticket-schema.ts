import { z } from "zod";

const MAX_TICKET_TITLE_LENGTH = 200;

export const ticketTitleSchema = z
  .string({ message: "タイトルを入力してください" })
  .min(1, "タイトルを入力してください")
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, "タイトルを入力してください")
  .refine(
    (value) => value.length <= MAX_TICKET_TITLE_LENGTH,
    `タイトルは${MAX_TICKET_TITLE_LENGTH}文字以内で入力してください`,
  );

export const ticketStatusSchema = z.enum(["open", "in-progress", "closed"], {
  message: "ステータスの値が正しくありません",
});

export const createTicketInputSchema = z.object({
  title: ticketTitleSchema,
});

export const updateTicketStatusInputSchema = z.object({
  status: ticketStatusSchema,
});

export type CreateTicketInput = z.infer<typeof createTicketInputSchema>;
export type UpdateTicketStatusInput = z.infer<
  typeof updateTicketStatusInputSchema
>;

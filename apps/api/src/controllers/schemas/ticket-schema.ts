import {
  ticketDescriptionSchema,
  ticketPrioritySchema,
  ticketTitleSchema,
} from "@ticket-flow/shared";
import { z } from "zod";

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

import {
  ticketDescriptionSchema,
  ticketPrioritySchema,
  ticketTitleSchema,
} from "@ticket-flow/shared";
import { z } from "zod";

export const createTicketFormSchema = z.object({
  title: ticketTitleSchema,
  description: ticketDescriptionSchema,
  priority: ticketPrioritySchema,
  assigneeId: z.string().nullable().optional(),
});

export type CreateTicketFormInput = z.infer<typeof createTicketFormSchema>;

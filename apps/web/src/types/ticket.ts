import {
  ticketAssigneeSchema,
  ticketListItemResponseSchema,
  type TicketPriority,
  type TicketStatus,
} from "@ticket-flow/shared";
import { z } from "zod";

export type { TicketPriority, TicketStatus };
export type TicketAssignee = z.infer<typeof ticketAssigneeSchema>;
export type TicketListItem = z.infer<typeof ticketListItemResponseSchema>;

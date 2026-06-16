import { createTicket, type Ticket } from "./domain/ticket";

function formatTicket(ticket: Ticket): string {
  return `[${ticket.status}] ${ticket.id}: ${ticket.title}`;
}

export type { Ticket };
export { createTicket, formatTicket };

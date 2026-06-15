type Ticket = {
  readonly id: string;
  readonly title: string;
  readonly status: "open" | "in-progress" | "closed";
};

function createTicket(id: string, title: string): Ticket {
  return {
    id,
    title,
    status: "open",
  };
}

function formatTicket(ticket: Ticket): string {
  return `[${ticket.status}] ${ticket.id}: ${ticket.title}`;
}

export type { Ticket };
export { createTicket, formatTicket };

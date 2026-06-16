export type Ticket = {
  readonly id: string;
  readonly title: string;
  readonly status: "open" | "in-progress" | "closed";
};

export function createTicket(id: string, title: string): Ticket {
  return {
    id,
    title,
    status: "open",
  };
}

export function formatTicket(ticket: Ticket): string {
  return `[${ticket.status}] ${ticket.id}: ${ticket.title}`;
}

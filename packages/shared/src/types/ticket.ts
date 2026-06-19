export type TicketStatus = "open" | "in-progress" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";

export type Ticket = {
  readonly id: string;
  readonly organizationId: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: TicketStatus;
  readonly priority: TicketPriority;
  readonly assigneeId: string | null;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export function createTicket(
  id: string,
  organizationId: string,
  title: string,
  createdBy: string,
): Ticket {
  return {
    id,
    organizationId,
    title,
    description: null,
    status: "open",
    priority: "medium",
    assigneeId: null,
    createdBy,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function formatTicket(ticket: Ticket): string {
  return `[${ticket.status}] ${ticket.id}: ${ticket.title}`;
}

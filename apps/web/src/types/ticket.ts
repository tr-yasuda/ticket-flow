import type { TicketPriority, TicketStatus } from "@ticket-flow/shared";

export type TicketAssignee = Readonly<{
  id: string;
  name: string | null;
}>;

export type TicketListItem = Readonly<{
  id: string;
  organizationId: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignee: TicketAssignee | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  commentCount: number;
}>;

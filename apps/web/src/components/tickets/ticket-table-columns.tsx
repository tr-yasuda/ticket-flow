import type { ReactNode } from "react";

import { TicketPriorityBadge } from "@/components/ticket-priority-badge";
import { TicketStatusBadge } from "@/components/ticket-status-badge";
import type { TicketPriority, TicketStatus } from "@/lib/badge-mapping";

export type TicketAssignee = Readonly<{
  id: string;
  name: string;
}>;

export type TicketListItem = Readonly<{
  id: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignee: TicketAssignee | null;
}>;

export type TicketTableColumn = {
  key: string;
  header: ReactNode;
  cell: (ticket: TicketListItem) => ReactNode;
};

function AssigneeCell({ assignee }: { assignee: TicketAssignee | null }) {
  if (assignee === null) {
    return <span className="text-muted-foreground">未割当</span>;
  }
  return <span>{assignee.name}</span>;
}

export const ticketTableColumns: TicketTableColumn[] = [
  {
    key: "title",
    header: "タイトル",
    cell: (ticket) => <span className="font-medium">{ticket.title}</span>,
  },
  {
    key: "status",
    header: "ステータス",
    cell: (ticket) => <TicketStatusBadge status={ticket.status} />,
  },
  {
    key: "priority",
    header: "優先度",
    cell: (ticket) => <TicketPriorityBadge priority={ticket.priority} />,
  },
  {
    key: "assignee",
    header: "担当者",
    cell: (ticket) => <AssigneeCell assignee={ticket.assignee} />,
  },
];

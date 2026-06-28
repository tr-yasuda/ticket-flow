import { Link } from "@tanstack/react-router";
import type { TicketPriority, TicketStatus } from "@ticket-flow/shared";
import type { ReactNode } from "react";

import { TicketPriorityBadge } from "@/components/ticket-priority-badge";
import { TicketStatusBadge } from "@/components/ticket-status-badge";

export type TicketAssignee = Readonly<{
  id: string;
  name: string | null;
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
  return (
    <span title={`ユーザー ID: ${assignee.id}`}>
      {assignee.name ?? `（ID: ${assignee.id}）`}
    </span>
  );
}

function toSafeHref(raw: string): string {
  if (raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }

  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin === window.location.origin) {
      return raw;
    }
  } catch {
    // 無効な URL はフォールバック
  }

  return "/";
}

function TitleCell({
  ticket,
  getRowHref,
}: {
  ticket: TicketListItem;
  getRowHref?: (ticket: TicketListItem) => string;
}) {
  if (getRowHref === undefined) {
    return <span className="font-medium">{ticket.title}</span>;
  }

  const href = toSafeHref(getRowHref(ticket));

  return (
    <Link
      to={href}
      className="block font-medium hover:underline"
      aria-label={`${ticket.title}の詳細を開く`}
    >
      {ticket.title}
    </Link>
  );
}

export function createTicketTableColumns(
  getRowHref?: (ticket: TicketListItem) => string,
): TicketTableColumn[] {
  return [
    {
      key: "title",
      header: "タイトル",
      cell: (ticket) => <TitleCell ticket={ticket} getRowHref={getRowHref} />,
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
}

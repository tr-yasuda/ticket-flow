import { Inbox } from "lucide-react";
import type { KeyboardEvent, ReactElement, ReactNode } from "react";

import { EmptyState, ErrorState, LoadingSpinner } from "@/components/feedback";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  ticketTableColumns,
  type TicketListItem,
} from "./ticket-table-columns.js";

export type TicketTableProps = {
  tickets?: TicketListItem[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onRowClick?: (ticket: TicketListItem) => void;
  emptyAction?: ReactNode;
};

export function TicketTable({
  tickets,
  isLoading = false,
  error = null,
  onRetry,
  onRowClick,
  emptyAction,
}: TicketTableProps): ReactElement {
  if (isLoading) {
    return <LoadingSpinner message="チケットを読み込んでいます…" />;
  }

  if (error !== null) {
    return (
      <ErrorState
        title="チケットの取得に失敗しました"
        message="接続を確認して、もう一度お試しください。"
        onRetry={onRetry}
      />
    );
  }

  if (tickets === undefined || tickets.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="チケットがありません"
        description="新しいチケットを作成してください"
      >
        {emptyAction}
      </EmptyState>
    );
  }

  function handleRowKeyDown(
    event: KeyboardEvent<HTMLTableRowElement>,
    ticket: TicketListItem,
  ) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    onRowClick?.(ticket);
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {ticketTableColumns.map((column) => (
              <TableHead key={column.key}>{column.header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.map((ticket) => (
            <TableRow
              key={ticket.id}
              data-row-id={ticket.id}
              role="button"
              tabIndex={0}
              aria-label={ticket.title}
              className="cursor-pointer"
              onClick={() => onRowClick?.(ticket)}
              onKeyDown={(event) => handleRowKeyDown(event, ticket)}
            >
              {ticketTableColumns.map((column) => (
                <TableCell key={`${ticket.id}-${column.key}`}>
                  {column.cell(ticket)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

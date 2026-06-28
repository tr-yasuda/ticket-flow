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
import { ApiError } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/api-error";

import {
  ticketTableColumns,
  type TicketListItem,
} from "./ticket-table-columns.js";

export type TicketTableProps = {
  tickets?: readonly TicketListItem[];
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
    const message =
      error instanceof ApiError ? error.message : getApiErrorMessage(error);

    return (
      <ErrorState
        title="チケットの取得に失敗しました"
        message={message}
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
          {tickets.map((ticket) => {
            const isInteractive = onRowClick !== undefined;
            return (
              <TableRow
                key={ticket.id}
                data-row-id={ticket.id}
                role={isInteractive ? "button" : undefined}
                tabIndex={isInteractive ? 0 : undefined}
                aria-label={isInteractive ? ticket.title : undefined}
                className={isInteractive ? "cursor-pointer" : undefined}
                onClick={() => onRowClick?.(ticket)}
                onKeyDown={
                  isInteractive
                    ? (event) => handleRowKeyDown(event, ticket)
                    : undefined
                }
              >
                {ticketTableColumns.map((column) => (
                  <TableCell key={`${ticket.id}-${column.key}`}>
                    {column.cell(ticket)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

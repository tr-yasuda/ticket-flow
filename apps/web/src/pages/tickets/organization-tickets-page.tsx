import { useNavigate } from "@tanstack/react-router";
import { useCallback, useState, type ReactElement } from "react";

import { TicketTable } from "@/components/tickets/ticket-table";
import type { TicketListItem } from "@/components/tickets/ticket-table-columns";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { useTickets } from "@/hooks/use-tickets";

export type OrganizationTicketsPageViewProps = {
  organizationId: string;
  tickets: readonly TicketListItem[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onRowClick?: (ticket: TicketListItem) => void;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
};

export function OrganizationTicketsPageView({
  organizationId,
  tickets,
  isLoading = false,
  error = null,
  onRetry,
  onRowClick,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
}: OrganizationTicketsPageViewProps): ReactElement {
  const hasData = !isLoading && error === null && tickets.length > 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">チケット</h1>
        <p data-testid="organization-id">{organizationId}</p>
      </div>
      <TicketTable
        tickets={tickets}
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        onRowClick={onRowClick}
        emptyAction={
          <Button type="button" className="mt-2">
            新規作成
          </Button>
        }
      />
      {hasData && (
        <div className="flex justify-end">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange ?? (() => {})}
          />
        </div>
      )}
    </div>
  );
}

const DEFAULT_ITEMS_PER_PAGE = 20;

export type OrganizationTicketsPageProps = {
  organizationId: string;
  perPage?: number;
};

export function OrganizationTicketsPage({
  organizationId,
  perPage = DEFAULT_ITEMS_PER_PAGE,
}: OrganizationTicketsPageProps): ReactElement {
  const navigate = useNavigate();
  const [requestedPage, setRequestedPage] = useState(1);
  const { tickets, isLoading, error, currentPage, totalPages, refetch } =
    useTickets({
      organizationId,
      page: requestedPage,
      perPage,
      enabled: organizationId !== "",
    });

  const handleRowClick = useCallback(
    (ticket: TicketListItem) => {
      void navigate({
        to: "/app/$organizationId/tickets/$ticketId",
        params: { organizationId, ticketId: ticket.id },
      });
    },
    [navigate, organizationId],
  );

  return (
    <OrganizationTicketsPageView
      organizationId={organizationId}
      tickets={tickets}
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      onRowClick={handleRowClick}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={setRequestedPage}
    />
  );
}

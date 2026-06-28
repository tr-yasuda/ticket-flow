import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactElement } from "react";

import { TicketTable } from "@/components/tickets/ticket-table";
import type { TicketListItem } from "@/components/tickets/ticket-table-columns";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { listTickets } from "@/lib/tickets-api";

export type OrganizationTicketsPageViewProps = {
  organizationId: string;
  tickets: TicketListItem[];
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

type OrganizationTicketsPageProps = {
  organizationId: string;
};

const itemsPerPage = 2;

export function OrganizationTicketsPage({
  organizationId,
}: OrganizationTicketsPageProps): ReactElement {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);

  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTickets = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await listTickets({
        organizationId,
        page: currentPage,
        perPage: itemsPerPage,
      });
      setTickets([...result.tickets]);
      setTotalPages(result.meta.totalPages);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError
          : new Error("チケット一覧の取得に失敗しました"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchTickets();
  }, [organizationId, currentPage]);

  const handleRowClick = (ticket: TicketListItem) => {
    // TODO: チケット詳細画面実装時に正しいルートへ遷移させる
    void navigate({
      to: `/app/${encodeURIComponent(organizationId)}/tickets/${encodeURIComponent(ticket.id)}`,
    });
  };

  return (
    <OrganizationTicketsPageView
      organizationId={organizationId}
      tickets={tickets}
      isLoading={isLoading}
      error={error}
      onRetry={fetchTickets}
      onRowClick={handleRowClick}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={setCurrentPage}
    />
  );
}

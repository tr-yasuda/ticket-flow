import { useNavigate } from "@tanstack/react-router";
import { useState, type ReactElement } from "react";

import { TicketTable } from "@/components/tickets/ticket-table";
import type { TicketListItem } from "@/components/tickets/ticket-table-columns";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { demoTickets } from "@/mocks/data/tickets";

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

  // TODO: #48, #49 のデータ取得基盤が整備されたら内部 state + データ取得 hook に置き換える
  const totalPages = Math.max(1, Math.ceil(demoTickets.length / itemsPerPage));
  const paginatedTickets = demoTickets.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const handleRowClick = (ticket: TicketListItem) => {
    // TODO: チケット詳細画面実装時に正しいルートへ遷移させる
    void navigate({
      to: `/app/${encodeURIComponent(organizationId)}/tickets/${encodeURIComponent(ticket.id)}`,
    });
  };

  return (
    <OrganizationTicketsPageView
      organizationId={organizationId}
      tickets={paginatedTickets}
      onRowClick={handleRowClick}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={setCurrentPage}
    />
  );
}

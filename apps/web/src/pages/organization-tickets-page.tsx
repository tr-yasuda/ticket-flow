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
  onCreateClick?: () => void;
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
  onCreateClick,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
}: OrganizationTicketsPageViewProps): ReactElement {
  const hasData = !isLoading && error === null && tickets.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">チケット</h1>
          <p data-testid="organization-id">{organizationId}</p>
        </div>
        <Button type="button" onClick={onCreateClick}>
          新規作成
        </Button>
      </div>
      <TicketTable
        tickets={tickets}
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        onRowClick={onRowClick}
        emptyAction={
          <Button type="button" className="mt-2" onClick={onCreateClick}>
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

  // TODO: チケット詳細画面実装後に詳細ルートへ遷移させる
  const handleRowClick = (_ticket: TicketListItem) => {
    // no-op
  };

  const handleCreateClick = () => {
    void navigate({
      to: `/app/${encodeURIComponent(organizationId)}/tickets/new`,
    });
  };

  return (
    <OrganizationTicketsPageView
      organizationId={organizationId}
      tickets={paginatedTickets}
      onRowClick={handleRowClick}
      onCreateClick={handleCreateClick}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={setCurrentPage}
    />
  );
}

import type { ReactElement } from "react";

import { Skeleton } from "@/components/ui/skeleton";

export type TicketDetailPageProps = {
  organizationId: string;
  ticketId: string;
};

export function TicketDetailPage({
  organizationId,
  ticketId,
}: TicketDetailPageProps): ReactElement {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-8 w-3/4" data-testid="ticket-detail-skeleton" />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span data-testid="ticket-detail-organization-id">
            {organizationId}
          </span>
          <span>/</span>
          <span data-testid="ticket-detail-ticket-id">{ticketId}</span>
        </div>
      </div>
      <div className="space-y-2 rounded-md border p-4">
        <Skeleton className="h-4 w-full" data-testid="ticket-detail-skeleton" />
        <Skeleton className="h-4 w-5/6" data-testid="ticket-detail-skeleton" />
        <Skeleton className="h-4 w-4/6" data-testid="ticket-detail-skeleton" />
      </div>
      <p className="text-sm text-muted-foreground">
        チケット詳細画面は準備中です。
      </p>
    </div>
  );
}

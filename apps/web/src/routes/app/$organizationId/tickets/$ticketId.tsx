import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { TicketDetailPage } from "@/pages/tickets/ticket-detail-page";

// TODO(#141): organizationId / ticketId の認可・存在チェックを追加する
export const Route = createFileRoute("/app/$organizationId/tickets/$ticketId")({
  component: TicketDetailRoute,
});

function TicketDetailRoute(): ReactElement {
  const { organizationId, ticketId } = Route.useParams();

  return (
    <TicketDetailPage organizationId={organizationId} ticketId={ticketId} />
  );
}

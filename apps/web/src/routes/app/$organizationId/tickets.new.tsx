import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { TicketCreatePage } from "@/pages/ticket-create-page";

export const Route = createFileRoute("/app/$organizationId/tickets/new")({
  component: TicketCreateRoute,
});

function TicketCreateRoute(): ReactElement {
  const { organizationId } = Route.useParams();

  return <TicketCreatePage organizationId={organizationId} />;
}

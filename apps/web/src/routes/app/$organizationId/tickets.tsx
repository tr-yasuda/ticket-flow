import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { OrganizationTicketsPage } from "@/pages/organization-tickets-page";

export const Route = createFileRoute("/app/$organizationId/tickets")({
  component: OrganizationTicketsRoute,
});

function OrganizationTicketsRoute(): ReactElement {
  const { organizationId } = Route.useParams();

  return <OrganizationTicketsPage organizationId={organizationId} />;
}

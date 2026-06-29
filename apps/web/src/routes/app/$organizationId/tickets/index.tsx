import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { OrganizationTicketsPage } from "@/pages/tickets/organization-tickets-page";

export const Route = createFileRoute("/app/$organizationId/tickets/")({
  component: OrganizationTicketsIndexRoute,
});

function OrganizationTicketsIndexRoute(): ReactElement {
  const organizationId = Route.useParams({
    select: (params) => params.organizationId,
  });

  return (
    <OrganizationTicketsPage
      key={organizationId}
      organizationId={organizationId}
    />
  );
}

import { createRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { Route as rootRoute } from "@/routes/__root";

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app/$organizationId/tickets",
  component: OrganizationTicketsPage,
});

function OrganizationTicketsPage(): ReactElement {
  const { organizationId } = Route.useParams();

  return (
    <div>
      <h1 className="text-2xl font-bold">Tickets</h1>
      <p data-testid="organization-id">{organizationId}</p>
    </div>
  );
}

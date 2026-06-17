import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";

export const Route = createFileRoute("/app/$organizationId/tickets")({
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

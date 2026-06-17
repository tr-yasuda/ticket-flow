import type { ReactElement } from "react";

type OrganizationTicketsPageProps = {
  organizationId: string;
};

export function OrganizationTicketsPage({
  organizationId,
}: OrganizationTicketsPageProps): ReactElement {
  return (
    <div>
      <h1 className="text-2xl font-bold">Tickets</h1>
      <p data-testid="organization-id">{organizationId}</p>
    </div>
  );
}

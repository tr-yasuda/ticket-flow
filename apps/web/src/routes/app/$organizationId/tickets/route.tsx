import { createFileRoute, Outlet } from "@tanstack/react-router";
import type { ReactElement } from "react";

export const Route = createFileRoute("/app/$organizationId/tickets")({
  component: TicketsLayout,
});

function TicketsLayout(): ReactElement {
  return <Outlet />;
}

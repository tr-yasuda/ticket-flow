import { createFileRoute, Outlet } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { AppShell } from "@/components/layout/AppShell";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout(): ReactElement {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

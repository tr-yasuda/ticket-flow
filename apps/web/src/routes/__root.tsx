import { createRootRoute, Outlet } from "@tanstack/react-router";
import { ThemeProvider } from "next-themes";
import type { ReactElement } from "react";

import { Toaster } from "@/components/ui/sonner";
import { NotFoundPage } from "@/pages/NotFoundPage";

function RootComponent(): ReactElement {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <Outlet />
      <Toaster
        position="top-right"
        duration={4000}
        visibleToasts={5}
        closeButton
      />
    </ThemeProvider>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundPage,
});

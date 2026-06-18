import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AuthProvider } from "@/contexts/auth-context";
import { OrganizationMembershipProvider } from "@/contexts/organization-membership-context";
import { isMswEnabled } from "@/mocks/env.js";
import { routeTree } from "@/routeTree.gen";

import "./index.css";

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

async function enableMocking(): Promise<void> {
  if (!isMswEnabled()) {
    return;
  }

  const { worker } = await import("./mocks/browser.js");
  await worker.start({
    onUnhandledRequest: "bypass",
  });
}

function renderApp(): void {
  const container = document.getElementById("root");
  if (container === null) {
    throw new Error("Root element not found");
  }

  createRoot(container).render(
    <StrictMode>
      <AuthProvider>
        <OrganizationMembershipProvider>
          <RouterProvider router={router} />
        </OrganizationMembershipProvider>
      </AuthProvider>
    </StrictMode>,
  );
}

enableMocking().finally(renderApp);

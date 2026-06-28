import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createApiPaginatedSuccessResponse } from "@ticket-flow/shared";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { AuthProvider } from "@/contexts/auth-context";
import { OrganizationMembershipProvider } from "@/contexts/organization-membership-context";
import { clearTokens, setTokens } from "@/lib/token-storage";
import { server } from "@/mocks/server.js";
import { routeTree } from "@/routeTree.gen";

const urlUnsafeTicket = {
  id: "ticket/with/slash",
  title: "URL 非安全チケット",
  status: "open" as const,
  priority: "medium" as const,
  assignee: null,
};

beforeEach(() => {
  server.use(
    http.get("/api/organizations/:id/tickets", () =>
      HttpResponse.json(
        createApiPaginatedSuccessResponse(
          { tickets: [urlUnsafeTicket] },
          { page: 1, perPage: 20, total: 1, totalPages: 1 },
        ),
        { status: 200 },
      ),
    ),
  );
});

function renderRoute(initialRoute: string, authenticated = false) {
  if (authenticated) {
    setTokens("mock-access-token", "mock-refresh-token");
  } else {
    clearTokens();
  }

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialRoute] }),
    defaultPendingMinMs: 0,
  });

  render(
    <AuthProvider>
      <OrganizationMembershipProvider>
        <RouterProvider router={router} />
      </OrganizationMembershipProvider>
    </AuthProvider>,
  );

  return router;
}

beforeEach(() => {
  clearTokens();
});

describe("OrganizationTicketsPage URL-safe navigation", () => {
  it("URL 非安全な ticketId を正しくエンコードして遷移する", async () => {
    const router = renderRoute("/app/demo-org-001/tickets", true);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "URL 非安全チケット" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "URL 非安全チケット" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        "/app/demo-org-001/tickets/ticket%2Fwith%2Fslash",
      );
    });
  });
});

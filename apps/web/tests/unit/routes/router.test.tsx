import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { AuthProvider } from "@/contexts/auth-context";
import { OrganizationMembershipProvider } from "@/contexts/organization-membership-context";
import { clearTokens, setTokens } from "@/lib/token-storage";
import { routeTree } from "@/routeTree.gen";

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

describe("routing", () => {
  beforeEach(() => {
    clearTokens();
  });

  it("redirects / to /login", async () => {
    renderRoute("/");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "ログイン" }),
      ).toBeInTheDocument();
    });
  });

  it("renders /login without AppShell", async () => {
    renderRoute("/login");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "ログイン" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: /Tickets/i }),
      ).not.toBeInTheDocument();
    });
  });

  it("renders /signup without AppShell", async () => {
    renderRoute("/signup");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "新規登録" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: /Tickets/i }),
      ).not.toBeInTheDocument();
    });
  });

  it("renders /app inside AppShell when authenticated", async () => {
    renderRoute("/app", true);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "アプリトップ" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /Tickets/i }),
      ).toBeInTheDocument();
    });
  });

  it("redirects /app to /login when not authenticated", async () => {
    renderRoute("/app");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "ログイン" }),
      ).toBeInTheDocument();
    });
  });

  it("redirects /login to /app when authenticated", async () => {
    renderRoute("/login", true);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "アプリトップ" }),
      ).toBeInTheDocument();
    });
  });

  it("redirects /signup to /app when authenticated", async () => {
    renderRoute("/signup", true);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "アプリトップ" }),
      ).toBeInTheDocument();
    });
  });

  it("renders /app/:organizationId/tickets inside AppShell with typed param when authenticated", async () => {
    renderRoute("/app/org-123/tickets", true);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "チケット" }),
      ).toBeInTheDocument();
      expect(screen.getByTestId("organization-id")).toHaveTextContent(
        "org-123",
      );
      expect(
        screen.getByRole("link", { name: /Tickets/i }),
      ).toBeInTheDocument();
    });
  });

  it("renders NotFound for unknown paths", async () => {
    renderRoute("/nonexistent");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "ページが見つかりません" }),
      ).toBeInTheDocument();
    });
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

function renderRoute(initialRoute: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialRoute] }),
    defaultPendingMinMs: 0,
  });

  render(<RouterProvider router={router} />);

  return router;
}

describe("routing", () => {
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

  it("renders /app inside AppShell", async () => {
    renderRoute("/app");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "アプリトップ" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /Tickets/i }),
      ).toBeInTheDocument();
    });
  });

  it("renders /app/:organizationId/tickets inside AppShell with typed param", async () => {
    renderRoute("/app/org-123/tickets");

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

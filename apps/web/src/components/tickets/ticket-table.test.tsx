import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import type { TicketListItem } from "./ticket-table-columns.js";
import { TicketTable } from "./ticket-table.js";

function renderWithRouter(element: ReactElement) {
  const rootRoute = createRootRoute({
    component: () => <Outlet />,
  });
  const testRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => element,
  });
  const routeTree = rootRoute.addChildren([testRoute]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/"] }),
    defaultPendingMinMs: 0,
  });
  render(<RouterProvider router={router} />);
  return router;
}

const sampleTickets: TicketListItem[] = [
  {
    id: "ticket-1",
    title: "ログイン画面の UI 改善",
    status: "open",
    priority: "medium",
    assignee: { id: "user-1", name: "山田太郎" },
  },
  {
    id: "ticket-2",
    title: "通知メール実装",
    status: "in-progress",
    priority: "high",
    assignee: null,
  },
  {
    id: "ticket-3",
    title: "ページネーション対応",
    status: "closed",
    priority: "low",
    assignee: { id: "user-3", name: null },
  },
];

describe("TicketTable", () => {
  it("ローディング状態を表示する", () => {
    render(<TicketTable isLoading />);
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });

  it("エラー状態を表示する", () => {
    const handleRetry = vi.fn();
    render(
      <TicketTable error={new Error("load failed")} onRetry={handleRetry} />,
    );
    expect(screen.getByTestId("error-state")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "再試行" })).toBeInTheDocument();
  });

  it("空状態を表示する", () => {
    render(<TicketTable tickets={[]} />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("チケット一覧を表示する", () => {
    render(<TicketTable tickets={sampleTickets} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("ログイン画面の UI 改善")).toBeInTheDocument();
    expect(screen.getByText("通知メール実装")).toBeInTheDocument();
  });

  it("ステータス・優先度・担当者を表示する", () => {
    render(<TicketTable tickets={sampleTickets} />);
    expect(screen.getByText("未対応")).toBeInTheDocument();
    expect(screen.getByText("対応中")).toBeInTheDocument();
    expect(screen.getByText("完了")).toBeInTheDocument();
    expect(screen.getByText("中")).toBeInTheDocument();
    expect(screen.getByText("高")).toBeInTheDocument();
    expect(screen.getByText("低")).toBeInTheDocument();
    expect(screen.getByText("山田太郎")).toBeInTheDocument();
    expect(screen.getByText("未割当")).toBeInTheDocument();
    expect(screen.getByText("（ID: user-3）")).toBeInTheDocument();
  });

  it("getRowHref があるときタイトルが詳細リンクになる", async () => {
    renderWithRouter(
      <TicketTable
        tickets={sampleTickets}
        getRowHref={(ticket) => `/tickets/${ticket.id}`}
      />,
    );
    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /ログイン画面の UI 改善/i }),
      ).toBeInTheDocument();
    });
    const link = screen.getByRole("link", { name: /ログイン画面の UI 改善/i });
    expect(link).toHaveAttribute("href", "/tickets/ticket-1");
    expect(link).toHaveAttribute(
      "aria-label",
      "ログイン画面の UI 改善の詳細を開く",
    );
  });

  it("getRowHref がないときタイトルは通常のテキストになる", () => {
    render(<TicketTable tickets={sampleTickets} />);
    expect(
      screen.queryByRole("link", { name: /ログイン画面の UI 改善/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("ログイン画面の UI 改善")).toBeInTheDocument();
  });

  it("安全でない getRowHref の結果は / にフォールバックする", async () => {
    renderWithRouter(
      <TicketTable
        tickets={sampleTickets}
        getRowHref={() => "javascript:alert(1)"}
      />,
    );
    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /ログイン画面の UI 改善/i }),
      ).toBeInTheDocument();
    });
    const link = screen.getByRole("link", { name: /ログイン画面の UI 改善/i });
    expect(link).toHaveAttribute("href", "/");
  });

  it("同一オリジンでも pathname が // で始まる絶対 URL は / にフォールバックする", async () => {
    const unsafeOriginUrl = `${window.location.origin}//evil.com`;
    renderWithRouter(
      <TicketTable
        tickets={sampleTickets}
        getRowHref={() => unsafeOriginUrl}
      />,
    );
    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /ログイン画面の UI 改善/i }),
      ).toBeInTheDocument();
    });
    const link = screen.getByRole("link", { name: /ログイン画面の UI 改善/i });
    expect(link).toHaveAttribute("href", "/");
  });

  it("行は button ロールにならない", async () => {
    renderWithRouter(
      <TicketTable
        tickets={sampleTickets}
        getRowHref={(ticket) => `/tickets/${ticket.id}`}
      />,
    );
    await waitFor(() => {
      expect(
        screen.getByRole("row", { name: /ログイン画面の UI 改善/i }),
      ).toBeInTheDocument();
    });
    const row = screen.getByRole("row", {
      name: /ログイン画面の UI 改善/i,
    });
    expect(within(row).queryByRole("button")).not.toBeInTheDocument();
  });

  it("各行に ticket id の data 属性を持つ", () => {
    render(<TicketTable tickets={sampleTickets} />);
    const dataRows = document.querySelectorAll("[data-row-id]");
    expect(dataRows).toHaveLength(3);
    expect(dataRows[0]).toHaveAttribute("data-row-id", "ticket-1");
    expect(dataRows[1]).toHaveAttribute("data-row-id", "ticket-2");
    expect(dataRows[2]).toHaveAttribute("data-row-id", "ticket-3");
  });
});

import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OrganizationTicketsPageView } from "@/pages/organization-tickets-page";
import { routeTree } from "@/routeTree.gen";

const sampleTickets = [
  {
    id: "ticket-1",
    title: "ログイン画面の UI 改善",
    status: "open" as const,
    priority: "medium" as const,
    assignee: { id: "user-1", name: "山田太郎" },
  },
  {
    id: "ticket-2",
    title: "通知メール実装",
    status: "in-progress" as const,
    priority: "high" as const,
    assignee: null,
  },
];

function renderRoute(initialRoute: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialRoute] }),
    defaultPendingMinMs: 0,
  });
  render(<RouterProvider router={router} />);
  return router;
}

describe("OrganizationTicketsPageView", () => {
  it("ローディング状態を表示する", () => {
    render(
      <OrganizationTicketsPageView
        organizationId="org-1"
        tickets={[]}
        isLoading
      />,
    );
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
    expect(screen.queryByText("1 / 1")).not.toBeInTheDocument();
  });

  it("エラー状態を表示する", () => {
    render(
      <OrganizationTicketsPageView
        organizationId="org-1"
        tickets={[]}
        error={new Error("load failed")}
      />,
    );
    expect(screen.getByTestId("error-state")).toBeInTheDocument();
    expect(screen.queryByText("1 / 1")).not.toBeInTheDocument();
  });

  it("空状態を表示する", () => {
    render(<OrganizationTicketsPageView organizationId="org-1" tickets={[]} />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "新規作成" }),
    ).toBeInTheDocument();
  });

  it("データあり状態を表示する", () => {
    render(
      <OrganizationTicketsPageView
        organizationId="org-1"
        tickets={sampleTickets}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "チケット" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("organization-id")).toHaveTextContent("org-1");
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("ページネーションを表示する", () => {
    render(
      <OrganizationTicketsPageView
        organizationId="org-1"
        tickets={sampleTickets}
        currentPage={1}
        totalPages={2}
      />,
    );
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "前へ" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "次へ" })).toBeInTheDocument();
  });

  it("行クリックで onRowClick を呼ぶ", () => {
    const handleRowClick = vi.fn();
    render(
      <OrganizationTicketsPageView
        organizationId="org-1"
        tickets={sampleTickets}
        onRowClick={handleRowClick}
      />,
    );
    const row = screen.getByRole("button", {
      name: "ログイン画面の UI 改善",
    });
    fireEvent.click(row);
    expect(handleRowClick).toHaveBeenCalledWith(sampleTickets[0]);
  });
});

describe("OrganizationTicketsPage", () => {
  it("organizationId とチケット一覧を表示する", async () => {
    renderRoute("/app/demo-org-001/tickets");
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "チケット" }),
      ).toBeInTheDocument();
    });
    expect(screen.getByTestId("organization-id")).toHaveTextContent(
      "demo-org-001",
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("ページ切り替えで表示チケットが変わる", async () => {
    renderRoute("/app/demo-org-001/tickets");
    await waitFor(() => {
      expect(screen.getByText("ログイン画面の UI 改善")).toBeInTheDocument();
    });
    expect(
      screen.queryByText("ユーザー一覧のページネーション対応"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "次へ" }));

    await waitFor(() => {
      expect(
        screen.queryByText("ログイン画面の UI 改善"),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByText("ユーザー一覧のページネーション対応"),
    ).toBeInTheDocument();
  });

  it("行クリックで詳細 URL へ遷移する", async () => {
    const router = renderRoute("/app/demo-org-001/tickets");
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "ログイン画面の UI 改善" }),
      ).toBeInTheDocument();
    });
    fireEvent.click(
      screen.getByRole("button", { name: "ログイン画面の UI 改善" }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        "/app/demo-org-001/tickets/demo-ticket-001",
      );
    });
  });
});

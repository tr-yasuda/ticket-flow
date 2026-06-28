import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  ApiErrorCode,
  createApiErrorResponse,
  createApiPaginatedSuccessResponse,
} from "@ticket-flow/shared";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@/contexts/auth-context";
import { OrganizationMembershipProvider } from "@/contexts/organization-membership-context";
import { clearTokens, setTokens } from "@/lib/token-storage";
import { server } from "@/mocks/server.js";
import { OrganizationTicketsPageView } from "@/pages/tickets/organization-tickets-page";
import { routeTree } from "@/routeTree.gen";

beforeEach(() => {
  clearTokens();
});

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
    renderRoute("/app/demo-org-001/tickets", true);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "チケット" }),
      ).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "ログイン画面の UI 改善" }),
      ).toBeInTheDocument();
    });
    expect(screen.getByTestId("organization-id")).toHaveTextContent(
      "demo-org-001",
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("ページ切り替えで表示チケットが変わる", async () => {
    renderRoute("/app/demo-org-001/tickets", true);
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

  it("行クリックで詳細 skeleton へ遷移する", async () => {
    const router = renderRoute("/app/demo-org-001/tickets", true);
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
      expect(screen.getByTestId("ticket-detail-ticket-id")).toHaveTextContent(
        "demo-ticket-001",
      );
      expect(
        screen.getByText("チケット詳細画面は準備中です。"),
      ).toBeInTheDocument();
    });
  });

  it("API エラー時にエラー状態を表示する", async () => {
    server.use(
      http.get("/api/organizations/:id/tickets", () =>
        HttpResponse.json(
          createApiErrorResponse(
            ApiErrorCode.INTERNAL_ERROR,
            "チケット一覧の取得に失敗しました",
          ),
          { status: 500 },
        ),
      ),
    );

    renderRoute("/app/demo-org-001/tickets", true);
    await waitFor(() => {
      expect(screen.getByTestId("error-state")).toBeInTheDocument();
    });
    expect(
      screen.getByText("チケット一覧の取得に失敗しました"),
    ).toBeInTheDocument();
  });

  it("API から空配列が返ると空状態を表示する", async () => {
    server.use(
      http.get("/api/organizations/:id/tickets", () =>
        HttpResponse.json(
          createApiPaginatedSuccessResponse(
            { tickets: [] },
            { page: 1, perPage: 20, total: 0, totalPages: 1 },
          ),
          { status: 200 },
        ),
      ),
    );

    renderRoute("/app/demo-org-001/tickets", true);
    await waitFor(() => {
      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("エラー時に再試行ボタンでデータを再取得する", async () => {
    server.use(
      http.get("/api/organizations/:id/tickets", () =>
        HttpResponse.json(
          createApiErrorResponse(
            ApiErrorCode.INTERNAL_ERROR,
            "チケット一覧の取得に失敗しました",
          ),
          { status: 500 },
        ),
      ),
    );

    renderRoute("/app/demo-org-001/tickets", true);
    await waitFor(() => {
      expect(screen.getByTestId("error-state")).toBeInTheDocument();
    });

    server.use(
      http.get("/api/organizations/:id/tickets", () =>
        HttpResponse.json(
          createApiPaginatedSuccessResponse(
            {
              tickets: [
                {
                  id: "demo-ticket-001",
                  title: "ログイン画面の UI 改善",
                  status: "open",
                  priority: "medium",
                  assignee: { id: "demo-user-001", name: null },
                },
              ],
            },
            { page: 1, perPage: 20, total: 1, totalPages: 1 },
          ),
          { status: 200 },
        ),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "再試行" }));

    await waitFor(() => {
      expect(screen.getByRole("table")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "ログイン画面の UI 改善" }),
    ).toBeInTheDocument();
  });
});

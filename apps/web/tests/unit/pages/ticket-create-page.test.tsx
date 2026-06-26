import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiErrorCode, createApiErrorResponse } from "@ticket-flow/shared";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@/contexts/auth-context";
import { OrganizationMembershipProvider } from "@/contexts/organization-membership-context";
import { clearTokens, setTokens } from "@/lib/token-storage";
import { server } from "@/mocks/server.js";
import { routeTree } from "@/routeTree.gen";

const organizationId = "demo-org-001";

function renderRoute(initialRoute: string) {
  clearTokens();
  setTokens("mock-access-token", "mock-refresh-token");

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

async function waitForForm() {
  await screen.findByRole("heading", { name: "チケットを作成" });
}

function fillTitle(value: string) {
  fireEvent.change(screen.getByLabelText("タイトル"), {
    target: { value },
  });
}

function submitForm() {
  fireEvent.click(screen.getByRole("button", { name: "作成" }));
}

describe("TicketCreatePage", () => {
  beforeEach(() => {
    clearTokens();
    vi.clearAllMocks();
  });

  it("フォーム項目を表示する", async () => {
    renderRoute(`/app/${organizationId}/tickets/new`);
    await waitForForm();

    expect(screen.getByLabelText("タイトル")).toBeInTheDocument();
    expect(screen.getByLabelText("説明")).toBeInTheDocument();
    expect(screen.getByLabelText("優先度")).toBeInTheDocument();
    expect(screen.getByLabelText("担当者")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "作成" })).toBeInTheDocument();
  });

  it("タイトルが空の場合にバリデーションエラーを表示する", async () => {
    renderRoute(`/app/${organizationId}/tickets/new`);
    await waitForForm();

    submitForm();

    await waitFor(() => {
      expect(
        screen.getByText("タイトルを入力してください"),
      ).toBeInTheDocument();
    });
  });

  it("タイトルが200文字の場合はバリデーションエラーにならない", async () => {
    renderRoute(`/app/${organizationId}/tickets/new`);
    await waitForForm();

    fillTitle("a".repeat(200));
    submitForm();

    await waitFor(() => {
      expect(
        screen.queryByText("タイトルは200文字以内で入力してください"),
      ).not.toBeInTheDocument();
    });
  });

  it("タイトルが201文字の場合にバリデーションエラーを表示する", async () => {
    renderRoute(`/app/${organizationId}/tickets/new`);
    await waitForForm();

    fillTitle("a".repeat(201));
    submitForm();

    await waitFor(() => {
      expect(
        screen.getByText("タイトルは200文字以内で入力してください"),
      ).toBeInTheDocument();
    });
  });

  it("作成成功後にチケット一覧へ遷移する", async () => {
    const router = renderRoute(`/app/${organizationId}/tickets/new`);
    await waitForForm();

    fillTitle("新規チケット");
    fireEvent.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        `/app/${organizationId}/tickets`,
      );
    });
  });

  it("API エラー時にエラーメッセージを表示する", async () => {
    server.use(
      http.post(`/api/organizations/${organizationId}/tickets`, () => {
        return HttpResponse.json(
          createApiErrorResponse(
            ApiErrorCode.VALIDATION_ERROR,
            "入力内容を確認してください",
            [{ field: "title", message: "タイトルが重複しています" }],
          ),
          { status: 400 },
        );
      }),
    );

    renderRoute(`/app/${organizationId}/tickets/new`);
    await waitForForm();

    fillTitle("重複タイトル");
    submitForm();

    await waitFor(() => {
      expect(screen.getByText("タイトルが重複しています")).toBeInTheDocument();
    });
  });

  it("作成中は送信ボタンを disabled にする", async () => {
    renderRoute(`/app/${organizationId}/tickets/new`);
    await waitForForm();

    fillTitle("遅延作成");
    submitForm();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "作成中…" })).toBeDisabled();
    });
  });

  it("メンバー一覧取得失敗時もフォームを表示する", async () => {
    server.use(
      http.get(`/api/organizations/${organizationId}/members`, () => {
        return new HttpResponse(null, { status: 500 });
      }),
    );

    renderRoute(`/app/${organizationId}/tickets/new`);
    await waitForForm();

    expect(screen.getByLabelText("担当者")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "作成" })).toBeInTheDocument();
  });

  it("キャンセルボタンでチケット一覧へ戻る", async () => {
    const router = renderRoute(`/app/${organizationId}/tickets/new`);
    await waitForForm();

    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        `/app/${organizationId}/tickets`,
      );
    });
  });
});

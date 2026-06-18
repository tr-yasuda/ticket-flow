import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { AuthProvider } from "@/contexts/auth-context";
import { OrganizationMembershipProvider } from "@/contexts/organization-membership-context";
import { clearTokens, getAccessToken } from "@/lib/token-storage";
import { demoUser } from "@/mocks/data/users.js";
import { routeTree } from "@/routeTree.gen";

function renderRoute(initialRoute: string) {
  clearTokens();

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

async function waitForLoginForm() {
  await screen.findByRole("heading", { name: "ログイン" });
}

describe("LoginPage", () => {
  beforeEach(() => {
    clearTokens();
  });

  it("有効な認証情報でログインし /app へ遷移する", async () => {
    const router = renderRoute("/login");
    await waitForLoginForm();

    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: demoUser.email },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: demoUser.password },
    });
    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/app");
    });
    expect(getAccessToken()).not.toBeNull();
  });

  it("無効な入力でバリデーションエラーを表示する", async () => {
    renderRoute("/login");
    await waitForLoginForm();

    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    await waitFor(() => {
      expect(
        screen.getByText("メールアドレスを入力してください"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("パスワードを入力してください"),
      ).toBeInTheDocument();
    });
  });

  it("メールアドレスの形式が不正な場合にエラーを表示する", async () => {
    renderRoute("/login");
    await waitForLoginForm();

    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "not-an-email" },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: demoUser.password },
    });
    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    await waitFor(() => {
      expect(
        screen.getByText("メールアドレスの形式が正しくありません"),
      ).toBeInTheDocument();
    });
  });

  it("誤った認証情報で API エラーを表示する", async () => {
    renderRoute("/login");
    await waitForLoginForm();

    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "wrong@example.com" },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "wrongpassword" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    await waitFor(() => {
      expect(
        screen.getByText("メールアドレスまたはパスワードが正しくありません"),
      ).toBeInTheDocument();
    });
  });
});

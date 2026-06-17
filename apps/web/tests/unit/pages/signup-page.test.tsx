import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { AuthProvider } from "@/contexts/auth-context";
import { clearTokens, getAccessToken } from "@/lib/token-storage";
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
      <RouterProvider router={router} />
    </AuthProvider>,
  );

  return router;
}

async function waitForSignupForm() {
  await screen.findByRole("heading", { name: "新規登録" });
}

describe("SignupPage", () => {
  beforeEach(() => {
    clearTokens();
  });

  it("有効な入力で登録し /login へ遷移する", async () => {
    const router = renderRoute("/signup");
    await waitForSignupForm();

    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "アカウントを作成" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
    });
    expect(getAccessToken()).toBeNull();
  });

  it("無効な入力でバリデーションエラーを表示する", async () => {
    renderRoute("/signup");
    await waitForSignupForm();

    fireEvent.click(screen.getByRole("button", { name: "アカウントを作成" }));

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
    renderRoute("/signup");
    await waitForSignupForm();

    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "not-an-email" },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "アカウントを作成" }));

    await waitFor(() => {
      expect(
        screen.getByText("メールアドレスの形式が正しくありません"),
      ).toBeInTheDocument();
    });
  });

  it("既存メールアドレスで API エラーを表示する", async () => {
    renderRoute("/signup");
    await waitForSignupForm();

    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "demo@example.com" },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "demo1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: "アカウントを作成" }));

    await waitFor(() => {
      expect(
        screen.getByText("このメールアドレスは既に登録されています"),
      ).toBeInTheDocument();
    });
  });

  it("パスワードが8バイト未満の場合にエラーを表示する", async () => {
    renderRoute("/signup");
    await waitForSignupForm();

    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "short" },
    });
    fireEvent.click(screen.getByRole("button", { name: "アカウントを作成" }));

    await waitFor(() => {
      expect(
        screen.getByText("パスワードは8バイト以上で入力してください"),
      ).toBeInTheDocument();
    });
  });
});

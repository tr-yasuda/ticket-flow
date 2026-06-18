import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import { createApiSuccessResponse } from "@ticket-flow/shared";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { AuthProvider } from "@/contexts/auth-context";
import { OrganizationMembershipProvider } from "@/contexts/organization-membership-context";
import { clearTokens, setTokens } from "@/lib/token-storage";
import { server } from "@/mocks/server.js";
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

describe("/onboarding/organization", () => {
  beforeEach(() => {
    clearTokens();
  });

  it("未認証ユーザーは /login へリダイレクトする", async () => {
    renderRoute("/onboarding/organization");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "ログイン" }),
      ).toBeInTheDocument();
    });
  });

  it("組織未所属ユーザーは onboarding 画面を表示する", async () => {
    server.use(
      http.get("/api/organizations", () => {
        return HttpResponse.json(
          createApiSuccessResponse({ organizations: [] }),
          { status: 200 },
        );
      }),
    );

    renderRoute("/onboarding/organization", true);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "組織を作成" }),
      ).toBeInTheDocument();
    });
  });

  it("組織所属済みユーザーは /app へリダイレクトする", async () => {
    const router = renderRoute("/onboarding/organization", true);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/app");
    });
  });

  it("組織取得に失敗した場合エラー画面を表示する", async () => {
    server.use(
      http.get("/api/organizations", () => {
        return new HttpResponse(null, { status: 500 });
      }),
    );

    renderRoute("/onboarding/organization", true);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "組織情報の取得に失敗しました" }),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "再試行" })).toBeInTheDocument();
  });
});

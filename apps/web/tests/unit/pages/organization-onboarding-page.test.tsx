import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createApiSuccessResponse } from "@ticket-flow/shared";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { AuthProvider } from "@/contexts/auth-context";
import { OrganizationMembershipProvider } from "@/contexts/organization-membership-context";
import { clearTokens, setTokens } from "@/lib/token-storage";
import { server } from "@/mocks/server.js";
import { routeTree } from "@/routeTree.gen";

type MockOrganization = Readonly<{
  id: string;
  name: string;
  slug: string;
  role: "owner";
}>;

function renderRoute(initialRoute: string) {
  clearTokens();
  setTokens("mock-access-token", "mock-refresh-token");

  const organizations: MockOrganization[] = [];

  server.use(
    http.get("/api/organizations", () => {
      return HttpResponse.json(createApiSuccessResponse({ organizations }), {
        status: 200,
      });
    }),
    http.post("/api/organizations", async ({ request }) => {
      const body = (await request.json()) as {
        name?: unknown;
        slug?: unknown;
      };
      const name = typeof body.name === "string" ? body.name : "New Org";
      const slug = typeof body.slug === "string" ? body.slug : "new-org";
      const organization: MockOrganization = {
        id: "mock-new-org-id",
        name,
        slug,
        role: "owner",
      };
      organizations.push(organization);
      return HttpResponse.json(
        createApiSuccessResponse({ id: organization.id, name, slug }),
        { status: 201 },
      );
    }),
  );

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

async function waitForOnboardingForm() {
  await screen.findByRole("heading", { name: "組織を作成" });
}

describe("OrganizationOnboardingPage", () => {
  beforeEach(() => {
    clearTokens();
  });

  it("組織名を入力して作成後 /app へ遷移する", async () => {
    const router = renderRoute("/onboarding/organization");
    await waitForOnboardingForm();

    fireEvent.change(screen.getByLabelText("組織名"), {
      target: { value: "New Organization" },
    });
    fireEvent.click(screen.getByRole("button", { name: "組織を作成" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "アプリトップ" }),
      ).toBeInTheDocument();
    });
    expect(router.state.location.pathname).toBe("/app");
  });

  it("空の組織名でバリデーションエラーを表示する", async () => {
    renderRoute("/onboarding/organization");
    await waitForOnboardingForm();

    fireEvent.click(screen.getByRole("button", { name: "組織を作成" }));

    await waitFor(() => {
      expect(screen.getByText("組織名を入力してください")).toBeInTheDocument();
    });
  });

  it("作成成功後の組織再取得に失敗した場合エラーを表示する", async () => {
    renderRoute("/onboarding/organization");
    await waitForOnboardingForm();

    server.use(
      http.get("/api/organizations", () => {
        return new HttpResponse(null, { status: 500 });
      }),
    );

    fireEvent.change(screen.getByLabelText("組織名"), {
      target: { value: "New Organization" },
    });
    fireEvent.click(screen.getByRole("button", { name: "組織を作成" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "組織情報の取得に失敗しました" }),
      ).toBeInTheDocument();
    });
  });

  it("組織 URL が重複する場合に日本語エラーを表示する", async () => {
    renderRoute("/onboarding/organization");
    await waitForOnboardingForm();

    server.use(
      http.post("/api/organizations", () => {
        return HttpResponse.json(
          {
            success: false,
            error: { code: "CONFLICT", message: "Slug already exists" },
          },
          { status: 409 },
        );
      }),
    );

    fireEvent.change(screen.getByLabelText("組織名"), {
      target: { value: "Demo Organization" },
    });
    fireEvent.click(screen.getByRole("button", { name: "組織を作成" }));

    await waitFor(() => {
      expect(
        screen.getByText("この組織 URL は既に使用されています。"),
      ).toBeInTheDocument();
    });
  });
});

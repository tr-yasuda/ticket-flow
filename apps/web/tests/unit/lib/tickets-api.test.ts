import {
  ApiErrorCode,
  createApiErrorResponse,
  createApiPaginatedSuccessResponse,
} from "@ticket-flow/shared";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api-client";
import { listTickets } from "@/lib/tickets-api";
import { clearTokens, setTokens } from "@/lib/token-storage";
import { server } from "@/mocks/server.js";

beforeEach(() => {
  setTokens("mock-access-token", "mock-refresh-token");
});

afterEach(() => {
  clearTokens();
});

const validTicket = {
  id: "demo-ticket-001",
  title: "ログイン画面の UI 改善",
  status: "open",
  priority: "medium",
  assignee: { id: "demo-user-001", name: null },
};

const validMeta = {
  page: 1,
  perPage: 20,
  total: 1,
  totalPages: 1,
};

describe("listTickets", () => {
  it("ラップ済み成功レスポンスからチケット一覧とメタ情報を取得する", async () => {
    server.use(
      http.get("/api/organizations/:id/tickets", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("page")).toBe("1");
        expect(url.searchParams.get("perPage")).toBe("20");

        return HttpResponse.json(
          createApiPaginatedSuccessResponse(
            { tickets: [validTicket] },
            validMeta,
          ),
          { status: 200 },
        );
      }),
    );

    const result = await listTickets({ organizationId: "demo-org-001" });

    expect(result.tickets).toHaveLength(1);
    expect(result.tickets[0]).toEqual(validTicket);
    expect(result.page).toBe(1);
    expect(result.perPage).toBe(20);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it("page / perPage を正規化してからリクエストする", async () => {
    server.use(
      http.get("/api/organizations/:id/tickets", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("page")).toBe("1");
        expect(url.searchParams.get("perPage")).toBe("100");

        return HttpResponse.json(
          createApiPaginatedSuccessResponse(
            { tickets: [validTicket] },
            { page: 1, perPage: 100, total: 1, totalPages: 1 },
          ),
          { status: 200 },
        );
      }),
    );

    const result = await listTickets({
      organizationId: "demo-org-001",
      page: -1,
      perPage: 200,
    });

    expect(result.page).toBe(1);
    expect(result.perPage).toBe(100);
  });

  it("不正なチケット要素を含むレスポンスはエラー", async () => {
    server.use(
      http.get("/api/organizations/:id/tickets", () =>
        HttpResponse.json(
          createApiPaginatedSuccessResponse(
            {
              tickets: [{ ...validTicket, status: "invalid-status" }],
            },
            validMeta,
          ),
          { status: 200 },
        ),
      ),
    );

    await expect(
      listTickets({ organizationId: "demo-org-001" }),
    ).rejects.toThrow("Invalid tickets response");
  });

  it("ラップなしレスポンスはエラー", async () => {
    server.use(
      http.get("/api/organizations/:id/tickets", () =>
        HttpResponse.json(
          { tickets: [validTicket], meta: validMeta },
          {
            status: 200,
          },
        ),
      ),
    );

    await expect(
      listTickets({ organizationId: "demo-org-001" }),
    ).rejects.toThrow("Invalid tickets response");
  });

  it("不正な meta を含むレスポンスはエラー", async () => {
    server.use(
      http.get("/api/organizations/:id/tickets", () =>
        HttpResponse.json(
          createApiPaginatedSuccessResponse(
            { tickets: [validTicket] },
            { page: Number.NaN, perPage: 20, total: 1, totalPages: 1 },
          ),
          { status: 200 },
        ),
      ),
    );

    await expect(
      listTickets({ organizationId: "demo-org-001" }),
    ).rejects.toThrow("Invalid pagination meta");
  });

  it("HTTP エラーは ApiError として伝播する", async () => {
    server.use(
      http.get("/api/organizations/:id/tickets", () =>
        HttpResponse.json(
          createApiErrorResponse(ApiErrorCode.INTERNAL_ERROR, "サーバーエラー"),
          { status: 500 },
        ),
      ),
    );

    await expect(
      listTickets({ organizationId: "demo-org-001" }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("AbortSignal でリクエストをキャンセルできる", async () => {
    server.use(
      http.get("/api/organizations/:id/tickets", () =>
        HttpResponse.json(
          createApiPaginatedSuccessResponse(
            { tickets: [validTicket] },
            validMeta,
          ),
          { status: 200 },
        ),
      ),
    );

    const controller = new AbortController();
    controller.abort();

    await expect(
      listTickets({
        organizationId: "demo-org-001",
        signal: controller.signal,
      }),
    ).rejects.toThrow();
  });
});

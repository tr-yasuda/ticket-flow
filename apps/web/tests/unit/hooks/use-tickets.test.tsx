import { act, renderHook, waitFor } from "@testing-library/react";
import {
  createApiPaginatedSuccessResponse,
  createApiErrorResponse,
  ApiErrorCode,
} from "@ticket-flow/shared";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useTickets } from "@/hooks/use-tickets";
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
  status: "open" as const,
  priority: "medium" as const,
  assignee: { id: "demo-user-001", name: null as string | null },
};

function createSuccessHandler(
  responseMeta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  } = {
    page: 1,
    perPage: 20,
    total: 1,
    totalPages: 1,
  },
) {
  return http.get("/api/organizations/:id/tickets", () =>
    HttpResponse.json(
      createApiPaginatedSuccessResponse(
        { tickets: [validTicket] },
        responseMeta,
      ),
      { status: 200 },
    ),
  );
}

describe("useTickets", () => {
  it("初期状態はローディング中で、取得後はデータが表示される", async () => {
    server.use(createSuccessHandler());

    const { result } = renderHook(() =>
      useTickets({ organizationId: "demo-org-001" }),
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.tickets).toHaveLength(0);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.tickets).toHaveLength(1);
    expect(result.current.error).toBeNull();
    expect(result.current.totalPages).toBe(1);
  });

  it("エラー時は error が設定され、ローディングが終了する", async () => {
    server.use(
      http.get("/api/organizations/:id/tickets", () =>
        HttpResponse.json(
          createApiErrorResponse(ApiErrorCode.INTERNAL_ERROR, "サーバーエラー"),
          { status: 500 },
        ),
      ),
    );

    const { result } = renderHook(() =>
      useTickets({ organizationId: "demo-org-001" }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.tickets).toHaveLength(0);
  });

  it("page 変更で再取得する", async () => {
    server.use(
      createSuccessHandler({ page: 2, perPage: 20, total: 2, totalPages: 2 }),
    );

    const { result, rerender } = renderHook(
      ({ page }: { page: number }) =>
        useTickets({ organizationId: "demo-org-001", page }),
      { initialProps: { page: 1 } },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    rerender({ page: 2 });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.currentPage).toBe(2);
    expect(result.current.totalPages).toBe(2);
  });

  it("refetch で再取得する", async () => {
    server.use(createSuccessHandler());

    const { result } = renderHook(() =>
      useTickets({ organizationId: "demo-org-001" }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.tickets).toHaveLength(1);
  });

  it("enabled=false の場合はフェッチしない", async () => {
    server.use(createSuccessHandler());

    const { result } = renderHook(() =>
      useTickets({ organizationId: "demo-org-001", enabled: false }),
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.tickets).toHaveLength(0);
  });
});

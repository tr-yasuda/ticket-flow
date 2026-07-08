import { act, renderHook, waitFor } from "@testing-library/react";
import {
  createApiPaginatedSuccessResponse,
  createApiErrorResponse,
  ApiErrorCode,
  type TicketStatus,
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
  organizationId: "demo-org-001",
  title: "ログイン画面の UI 改善",
  status: "open" as const,
  priority: "medium" as const,
  assignee: { id: "demo-user-001", name: null as string | null },
  createdBy: "demo-user-001",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  commentCount: 0,
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

  it("organizationId 変更時にページを 1 にリセットする", async () => {
    server.use(
      http.get("/api/organizations/:id/tickets", ({ request }) => {
        const url = new URL(request.url);
        const page = Number(url.searchParams.get("page")) || 1;
        return HttpResponse.json(
          createApiPaginatedSuccessResponse(
            { tickets: [validTicket] },
            { page, perPage: 20, total: 2, totalPages: 2 },
          ),
          { status: 200 },
        );
      }),
    );

    const { result, rerender } = renderHook(
      ({ organizationId, page }: { organizationId: string; page: number }) =>
        useTickets({ organizationId, page }),
      { initialProps: { organizationId: "demo-org-001", page: 1 } },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    rerender({ organizationId: "demo-org-001", page: 2 });

    await waitFor(() => {
      expect(result.current.currentPage).toBe(2);
    });

    rerender({ organizationId: "demo-org-002", page: 2 });

    await waitFor(() => {
      expect(result.current.currentPage).toBe(1);
    });
  });

  it("enabled=false の場合はフェッチしない", async () => {
    server.use(createSuccessHandler());

    const { result } = renderHook(() =>
      useTickets({ organizationId: "demo-org-001", enabled: false }),
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.tickets).toHaveLength(0);
  });

  it("filter オプションを listTickets に渡す", async () => {
    const captured = {
      search: null as string | null,
      status: null as string | null,
      priority: null as string | null,
      assignee: null as string | null,
    };

    server.use(
      http.get("/api/organizations/:id/tickets", ({ request }) => {
        const url = new URL(request.url);
        captured.search = url.searchParams.get("search");
        captured.status = url.searchParams.get("status");
        captured.priority = url.searchParams.get("priority");
        captured.assignee = url.searchParams.get("assignee");
        return HttpResponse.json(
          createApiPaginatedSuccessResponse(
            { tickets: [validTicket] },
            { page: 1, perPage: 20, total: 1, totalPages: 1 },
          ),
          { status: 200 },
        );
      }),
    );

    const { result } = renderHook(() =>
      useTickets({
        organizationId: "demo-org-001",
        search: "ログイン",
        status: "open",
        priority: "high",
        assignee: "demo-user-001",
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(captured.search).toBe("ログイン");
    expect(captured.status).toBe("open");
    expect(captured.priority).toBe("high");
    expect(captured.assignee).toBe("demo-user-001");
  });

  it("filter 変更で再取得する", async () => {
    const capturedStatuses: (string | null)[] = [];

    server.use(
      http.get("/api/organizations/:id/tickets", ({ request }) => {
        const url = new URL(request.url);
        capturedStatuses.push(url.searchParams.get("status"));
        return HttpResponse.json(
          createApiPaginatedSuccessResponse(
            { tickets: [validTicket] },
            { page: 1, perPage: 20, total: 1, totalPages: 1 },
          ),
          { status: 200 },
        );
      }),
    );

    const { result, rerender } = renderHook(
      ({ status }: { status: TicketStatus }) =>
        useTickets({ organizationId: "demo-org-001", status }),
      { initialProps: { status: "open" as TicketStatus } },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    rerender({ status: "closed" as TicketStatus });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(capturedStatuses).toHaveLength(2);
    expect(capturedStatuses[0]).toBe("open");
    expect(capturedStatuses[1]).toBe("closed");
  });
});

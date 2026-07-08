import {
  ApiErrorCode,
  createApiErrorResponse,
  createApiPaginatedSuccessResponse,
  createApiSuccessResponse,
} from "@ticket-flow/shared";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api-client";
import { ApiResponseValidationError } from "@/lib/api-response";
import {
  createTicket,
  getTicket,
  getTickets,
  listTickets,
} from "@/lib/tickets-api";
import { clearTokens, setTokens } from "@/lib/token-storage";
import { server } from "@/mocks/server.js";

beforeEach(() => {
  setTokens("mock-access-token", "mock-refresh-token");
});

afterEach(() => {
  clearTokens();
});

const listTicketDates = {
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const validTicket = {
  id: "demo-ticket-001",
  organizationId: "demo-org-001",
  title: "ログイン画面の UI 改善",
  status: "open",
  priority: "medium",
  assignee: { id: "demo-user-001", name: null },
  createdBy: "demo-user-001",
  createdAt: new Date(listTicketDates.createdAt),
  updatedAt: new Date(listTicketDates.updatedAt),
  commentCount: 0,
};

const validMeta = {
  page: 1,
  perPage: 20,
  total: 1,
  totalPages: 1,
};

const validTicketDetail = {
  id: "demo-ticket-001",
  organizationId: "demo-org-001",
  title: "ログイン画面の UI 改善",
  description: null,
  status: "open",
  priority: "medium",
  assigneeId: "demo-user-001",
  createdBy: "demo-user-001",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  commentCount: 0,
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
            {
              tickets: [
                {
                  id: validTicket.id,
                  organizationId: validTicket.organizationId,
                  title: validTicket.title,
                  status: validTicket.status,
                  priority: validTicket.priority,
                  assignee: validTicket.assignee,
                  createdBy: validTicket.createdBy,
                  ...listTicketDates,
                  commentCount: validTicket.commentCount,
                },
              ],
            },
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
            { tickets: [] },
            { page: 1, perPage: 100, total: 0, totalPages: 0 },
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

  it("フィルタクエリパラメータを送信する", async () => {
    server.use(
      http.get("/api/organizations/:id/tickets", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("search")).toBe("ログイン");
        expect(url.searchParams.get("status")).toBe("open");
        expect(url.searchParams.get("priority")).toBe("high");
        expect(url.searchParams.get("assignee")).toBe("demo-user-001");

        return HttpResponse.json(
          createApiPaginatedSuccessResponse(
            { tickets: [] },
            { page: 1, perPage: 20, total: 0, totalPages: 0 },
          ),
          { status: 200 },
        );
      }),
    );

    await listTickets({
      organizationId: "demo-org-001",
      search: "  ログイン  ",
      status: "open",
      priority: "high",
      assignee: "demo-user-001",
    });
  });

  it("path parameter が encode される", async () => {
    server.use(
      http.get("/api/organizations/:id/tickets", ({ params }) => {
        expect(params.id).toBe("org/001");

        return HttpResponse.json(
          createApiPaginatedSuccessResponse(
            { tickets: [] },
            { page: 1, perPage: 20, total: 0, totalPages: 0 },
          ),
          { status: 200 },
        );
      }),
    );

    await listTickets({ organizationId: "org/001" });
  });

  it("空の organizationId は即座にエラー", async () => {
    await expect(listTickets({ organizationId: "" })).rejects.toThrow(
      "organizationId must not be empty",
    );
  });

  it("total が 0 の場合は totalPages も 0 を受け入れる", async () => {
    server.use(
      http.get("/api/organizations/:id/tickets", () =>
        HttpResponse.json(
          createApiPaginatedSuccessResponse(
            { tickets: [] },
            { page: 1, perPage: 20, total: 0, totalPages: 0 },
          ),
          { status: 200 },
        ),
      ),
    );

    const result = await listTickets({ organizationId: "demo-org-001" });

    expect(result.totalPages).toBe(0);
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
    ).rejects.toBeInstanceOf(ApiResponseValidationError);
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
    ).rejects.toBeInstanceOf(ApiResponseValidationError);
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
    ).rejects.toBeInstanceOf(ApiResponseValidationError);
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

  it("AbortSignal で in-flight リクエストをキャンセルできる", async () => {
    server.use(
      http.get("/api/organizations/:id/tickets", async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json(
          createApiPaginatedSuccessResponse(
            { tickets: [validTicket] },
            validMeta,
          ),
          { status: 200 },
        );
      }),
    );

    const controller = new AbortController();
    const promise = listTickets({
      organizationId: "demo-org-001",
      signal: controller.signal,
    });
    controller.abort();

    let caught: unknown;
    try {
      await promise;
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(DOMException);
    expect((caught as DOMException).name).toBe("AbortError");
  });
});

describe("getTickets", () => {
  it("listTickets のエイリアスとして動作する", async () => {
    server.use(
      http.get("/api/organizations/:id/tickets", () =>
        HttpResponse.json(
          createApiPaginatedSuccessResponse(
            {
              tickets: [
                {
                  id: validTicket.id,
                  organizationId: validTicket.organizationId,
                  title: validTicket.title,
                  status: validTicket.status,
                  priority: validTicket.priority,
                  assignee: validTicket.assignee,
                  createdBy: validTicket.createdBy,
                  ...listTicketDates,
                  commentCount: validTicket.commentCount,
                },
              ],
            },
            validMeta,
          ),
          { status: 200 },
        ),
      ),
    );

    const result = await getTickets({ organizationId: "demo-org-001" });

    expect(result.tickets).toHaveLength(1);
    expect(result.tickets[0]).toEqual(validTicket);
  });
});

describe("getTicket", () => {
  it("API shape（assigneeId）の正常レスポンスを parse できる", async () => {
    server.use(
      http.get("/api/organizations/:id/tickets/:ticketId", ({ params }) => {
        expect(params.id).toBe("demo-org-001");
        expect(params.ticketId).toBe("demo-ticket-001");

        return HttpResponse.json(createApiSuccessResponse(validTicketDetail), {
          status: 200,
        });
      }),
    );

    const result = await getTicket({
      organizationId: "demo-org-001",
      ticketId: "demo-ticket-001",
    });

    expect(result.id).toBe("demo-ticket-001");
    expect(result.assigneeId).toBe("demo-user-001");
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.commentCount).toBe(0);
  });

  it("MSW mock shape（assignee オブジェクト）を assigneeId に統合できる", async () => {
    server.use(
      http.get("/api/organizations/:id/tickets/:ticketId", () =>
        HttpResponse.json(
          createApiSuccessResponse({
            ...validTicketDetail,
            assigneeId: undefined,
            assignee: { id: "demo-user-001", name: null },
          }),
          { status: 200 },
        ),
      ),
    );

    const result = await getTicket({
      organizationId: "demo-org-001",
      ticketId: "demo-ticket-001",
    });

    expect(result.assigneeId).toBe("demo-user-001");
  });

  it("assigneeId: null のレスポンスを parse できる", async () => {
    server.use(
      http.get("/api/organizations/:id/tickets/:ticketId", () =>
        HttpResponse.json(
          createApiSuccessResponse({
            ...validTicketDetail,
            assigneeId: null,
          }),
          { status: 200 },
        ),
      ),
    );

    const result = await getTicket({
      organizationId: "demo-org-001",
      ticketId: "demo-ticket-001",
    });

    expect(result.assigneeId).toBeNull();
  });

  it("assigneeId: null の場合は assignee オブジェクトを無視する", async () => {
    server.use(
      http.get("/api/organizations/:id/tickets/:ticketId", () =>
        HttpResponse.json(
          createApiSuccessResponse({
            ...validTicketDetail,
            assigneeId: null,
            assignee: { id: "other-user", name: null },
          }),
          { status: 200 },
        ),
      ),
    );

    const result = await getTicket({
      organizationId: "demo-org-001",
      ticketId: "demo-ticket-001",
    });

    expect(result.assigneeId).toBeNull();
  });

  it("assigneeId と assignee の両方が欠けている詳細レスポンスはエラー", async () => {
    server.use(
      http.get("/api/organizations/:id/tickets/:ticketId", () => {
        const responseWithoutAssignee = {
          id: validTicketDetail.id,
          organizationId: validTicketDetail.organizationId,
          title: validTicketDetail.title,
          description: validTicketDetail.description,
          status: validTicketDetail.status,
          priority: validTicketDetail.priority,
          createdBy: validTicketDetail.createdBy,
          createdAt: validTicketDetail.createdAt,
          updatedAt: validTicketDetail.updatedAt,
          commentCount: validTicketDetail.commentCount,
        };
        return HttpResponse.json(
          createApiSuccessResponse(responseWithoutAssignee),
          { status: 200 },
        );
      }),
    );

    await expect(
      getTicket({
        organizationId: "demo-org-001",
        ticketId: "demo-ticket-001",
      }),
    ).rejects.toBeInstanceOf(ApiResponseValidationError);
  });

  it("空文字の assigneeId はエラー", async () => {
    server.use(
      http.get("/api/organizations/:id/tickets/:ticketId", () =>
        HttpResponse.json(
          createApiSuccessResponse({
            ...validTicketDetail,
            assigneeId: "",
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(
      getTicket({
        organizationId: "demo-org-001",
        ticketId: "demo-ticket-001",
      }),
    ).rejects.toBeInstanceOf(ApiResponseValidationError);
  });

  it("空文字 id の assignee オブジェクトはエラー", async () => {
    server.use(
      http.get("/api/organizations/:id/tickets/:ticketId", () =>
        HttpResponse.json(
          createApiSuccessResponse({
            ...validTicketDetail,
            assigneeId: undefined,
            assignee: { id: "", name: null },
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(
      getTicket({
        organizationId: "demo-org-001",
        ticketId: "demo-ticket-001",
      }),
    ).rejects.toBeInstanceOf(ApiResponseValidationError);
  });

  it("Date オブジェクトレスポンスを parse できる", async () => {
    server.use(
      http.get("/api/organizations/:id/tickets/:ticketId", () =>
        HttpResponse.json(
          createApiSuccessResponse({
            ...validTicketDetail,
            createdAt: new Date(validTicketDetail.createdAt),
            updatedAt: new Date(validTicketDetail.updatedAt),
          }),
          { status: 200 },
        ),
      ),
    );

    const result = await getTicket({
      organizationId: "demo-org-001",
      ticketId: "demo-ticket-001",
    });

    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
  });

  it("path parameter が encode される", async () => {
    server.use(
      http.get("/api/organizations/:id/tickets/:ticketId", ({ params }) => {
        expect(params.id).toBe("org/001");
        expect(params.ticketId).toBe("ticket 001");

        return HttpResponse.json(createApiSuccessResponse(validTicketDetail), {
          status: 200,
        });
      }),
    );

    await getTicket({
      organizationId: "org/001",
      ticketId: "ticket 001",
    });
  });

  it("空の ticketId は即座にエラー", async () => {
    await expect(
      getTicket({ organizationId: "demo-org-001", ticketId: "" }),
    ).rejects.toThrow("ticketId must not be empty");
  });

  it("不正な詳細レスポンスはエラー", async () => {
    server.use(
      http.get("/api/organizations/:id/tickets/:ticketId", () =>
        HttpResponse.json(
          createApiSuccessResponse({
            ...validTicketDetail,
            commentCount: -1,
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(
      getTicket({
        organizationId: "demo-org-001",
        ticketId: "demo-ticket-001",
      }),
    ).rejects.toBeInstanceOf(ApiResponseValidationError);
  });

  it("HTTP エラーは ApiError として伝播する", async () => {
    server.use(
      http.get("/api/organizations/:id/tickets/:ticketId", () =>
        HttpResponse.json(
          createApiErrorResponse(ApiErrorCode.INTERNAL_ERROR, "サーバーエラー"),
          { status: 500 },
        ),
      ),
    );

    await expect(
      getTicket({
        organizationId: "demo-org-001",
        ticketId: "demo-ticket-001",
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("AbortSignal で in-flight リクエストをキャンセルできる", async () => {
    server.use(
      http.get("/api/organizations/:id/tickets/:ticketId", async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json(createApiSuccessResponse(validTicketDetail), {
          status: 200,
        });
      }),
    );

    const controller = new AbortController();
    const promise = getTicket({
      organizationId: "demo-org-001",
      ticketId: "demo-ticket-001",
      signal: controller.signal,
    });
    controller.abort();

    let caught: unknown;
    try {
      await promise;
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(DOMException);
    expect((caught as DOMException).name).toBe("AbortError");
  });
});

describe("createTicket", () => {
  it("正常レスポンスを parse できる", async () => {
    server.use(
      http.post("/api/organizations/:id/tickets", async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body).not.toHaveProperty("status");
        expect(body.title).toBe("新規チケット");

        return HttpResponse.json(
          createApiSuccessResponse({
            ...validTicketDetail,
            title: "新規チケット",
          }),
          { status: 201 },
        );
      }),
    );

    const result = await createTicket({
      organizationId: "demo-org-001",
      title: "新規チケット",
    });

    expect(result.title).toBe("新規チケット");
    expect(result.assigneeId).toBe("demo-user-001");
  });

  it("オプションフィールドを含めて送信できる", async () => {
    server.use(
      http.post("/api/organizations/:id/tickets", async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.description).toBe("詳細");
        expect(body.priority).toBe("high");
        expect(body.assigneeId).toBe("demo-user-001");

        return HttpResponse.json(
          createApiSuccessResponse({
            ...validTicketDetail,
            description: "詳細",
            priority: "high",
            assigneeId: "demo-user-001",
          }),
          { status: 201 },
        );
      }),
    );

    await createTicket({
      organizationId: "demo-org-001",
      title: "新規チケット",
      description: "詳細",
      priority: "high",
      assigneeId: "demo-user-001",
    });
  });

  it("null のオプションフィールドを送信できる", async () => {
    server.use(
      http.post("/api/organizations/:id/tickets", async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.description).toBeNull();
        expect(body.assigneeId).toBeNull();

        return HttpResponse.json(
          createApiSuccessResponse({
            ...validTicketDetail,
            description: null,
            assigneeId: null,
          }),
          { status: 201 },
        );
      }),
    );

    await createTicket({
      organizationId: "demo-org-001",
      title: "新規チケット",
      description: null,
      assigneeId: null,
    });
  });

  it("path parameter が encode される", async () => {
    server.use(
      http.post("/api/organizations/:id/tickets", ({ params }) => {
        expect(params.id).toBe("org/001");

        return HttpResponse.json(createApiSuccessResponse(validTicketDetail), {
          status: 201,
        });
      }),
    );

    await createTicket({
      organizationId: "org/001",
      title: "新規チケット",
    });
  });

  it("空の organizationId は即座にエラー", async () => {
    await expect(
      createTicket({ organizationId: "", title: "新規チケット" }),
    ).rejects.toThrow("organizationId must not be empty");
  });

  it("HTTP エラーは ApiError として伝播する", async () => {
    server.use(
      http.post("/api/organizations/:id/tickets", () =>
        HttpResponse.json(
          createApiErrorResponse(ApiErrorCode.INTERNAL_ERROR, "サーバーエラー"),
          { status: 500 },
        ),
      ),
    );

    await expect(
      createTicket({
        organizationId: "demo-org-001",
        title: "新規チケット",
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("AbortSignal で in-flight リクエストをキャンセルできる", async () => {
    server.use(
      http.post("/api/organizations/:id/tickets", async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json(createApiSuccessResponse(validTicketDetail), {
          status: 201,
        });
      }),
    );

    const controller = new AbortController();
    const promise = createTicket({
      organizationId: "demo-org-001",
      title: "新規チケット",
      signal: controller.signal,
    });
    controller.abort();

    let caught: unknown;
    try {
      await promise;
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(DOMException);
    expect((caught as DOMException).name).toBe("AbortError");
  });
});

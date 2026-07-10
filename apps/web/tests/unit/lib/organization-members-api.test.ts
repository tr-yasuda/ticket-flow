import {
  ApiErrorCode,
  createApiErrorResponse,
  createApiPaginatedSuccessResponse,
} from "@ticket-flow/shared";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api-client";
import { ApiResponseValidationError } from "@/lib/api-response";
import { getOrganizationMembers } from "@/lib/organization-members-api";
import { clearTokens, setTokens } from "@/lib/token-storage";
import { server } from "@/mocks/server.js";

beforeEach(() => {
  setTokens("mock-access-token", "mock-refresh-token");
});

afterEach(() => {
  clearTokens();
});

const validMember = {
  id: "demo-member-001",
  userId: "demo-user-001",
  name: "Demo User",
  email: "demo@example.com",
  role: "owner",
  joinedAt: "2026-01-01T00:00:00.000Z",
};

const parsedValidMember = {
  ...validMember,
  joinedAt: new Date(validMember.joinedAt),
};

const validMeta = {
  page: 1,
  perPage: 20,
  total: 1,
  totalPages: 1,
};

describe("getOrganizationMembers", () => {
  it("ラップ済み成功レスポンスからメンバー一覧とメタ情報を取得する", async () => {
    server.use(
      http.get("/api/organizations/:id/members", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("page")).toBe("1");
        expect(url.searchParams.get("perPage")).toBe("20");

        return HttpResponse.json(
          createApiPaginatedSuccessResponse(
            { members: [validMember] },
            validMeta,
          ),
          { status: 200 },
        );
      }),
    );

    const result = await getOrganizationMembers({
      organizationId: "demo-org-001",
    });

    expect(result.members).toHaveLength(1);
    expect(result.members[0]).toEqual(parsedValidMember);
    expect(result.page).toBe(1);
    expect(result.perPage).toBe(20);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it("name: null のメンバーを parse できる", async () => {
    server.use(
      http.get("/api/organizations/:id/members", () =>
        HttpResponse.json(
          createApiPaginatedSuccessResponse(
            {
              members: [{ ...validMember, name: null }],
            },
            validMeta,
          ),
          { status: 200 },
        ),
      ),
    );

    const result = await getOrganizationMembers({
      organizationId: "demo-org-001",
    });

    expect(result.members[0].name).toBeNull();
  });

  it("page / perPage を正規化してからリクエストする", async () => {
    server.use(
      http.get("/api/organizations/:id/members", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("page")).toBe("1");
        expect(url.searchParams.get("perPage")).toBe("100");

        return HttpResponse.json(
          createApiPaginatedSuccessResponse(
            { members: [] },
            { page: 1, perPage: 100, total: 0, totalPages: 0 },
          ),
          { status: 200 },
        );
      }),
    );

    const result = await getOrganizationMembers({
      organizationId: "demo-org-001",
      page: -1,
      perPage: 200,
    });

    expect(result.page).toBe(1);
    expect(result.perPage).toBe(100);
  });

  it.each([
    { page: Number.NaN, expectedPage: 1 },
    { page: Number.POSITIVE_INFINITY, expectedPage: 1 },
    { page: 0, expectedPage: 1 },
    { page: 1.9, expectedPage: 1 },
    { page: 10001, expectedPage: 10000 },
  ])(
    "page の境界値 $page を $expectedPage に正規化する",
    async ({ page, expectedPage }) => {
      server.use(
        http.get("/api/organizations/:id/members", ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get("page")).toBe(String(expectedPage));

          return HttpResponse.json(
            createApiPaginatedSuccessResponse(
              { members: [] },
              { page: expectedPage, perPage: 20, total: 0, totalPages: 0 },
            ),
            { status: 200 },
          );
        }),
      );

      const result = await getOrganizationMembers({
        organizationId: "demo-org-001",
        page,
      });

      expect(result.page).toBe(expectedPage);
    },
  );

  it.each([
    { perPage: Number.NaN, expectedPerPage: 20 },
    { perPage: Number.POSITIVE_INFINITY, expectedPerPage: 20 },
    { perPage: 0, expectedPerPage: 1 },
    { perPage: 0.5, expectedPerPage: 1 },
    { perPage: 101, expectedPerPage: 100 },
  ])(
    "perPage の境界値 $perPage を $expectedPerPage に正規化する",
    async ({ perPage, expectedPerPage }) => {
      server.use(
        http.get("/api/organizations/:id/members", ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get("perPage")).toBe(String(expectedPerPage));

          return HttpResponse.json(
            createApiPaginatedSuccessResponse(
              { members: [] },
              { page: 1, perPage: expectedPerPage, total: 0, totalPages: 0 },
            ),
            { status: 200 },
          );
        }),
      );

      const result = await getOrganizationMembers({
        organizationId: "demo-org-001",
        perPage,
      });

      expect(result.perPage).toBe(expectedPerPage);
    },
  );

  it("path parameter が encode される", async () => {
    server.use(
      http.get("/api/organizations/:id/members", ({ request }) => {
        const url = new URL(request.url);
        expect(url.pathname).toContain("org%2F001/members");

        return HttpResponse.json(
          createApiPaginatedSuccessResponse(
            { members: [] },
            { page: 1, perPage: 20, total: 0, totalPages: 0 },
          ),
          { status: 200 },
        );
      }),
    );

    await getOrganizationMembers({ organizationId: "org/001" });
  });

  it.each([".", ".."])(
    "相対パスセグメントの organizationId は即座にエラー (%s)",
    async (organizationId) => {
      await expect(getOrganizationMembers({ organizationId })).rejects.toThrow(
        "organizationId must not be a relative path segment",
      );
    },
  );

  it.each(["", "   ", "\t\n"])(
    "空または空白のみの organizationId は即座にエラー (%#)",
    async (organizationId) => {
      await expect(getOrganizationMembers({ organizationId })).rejects.toThrow(
        "organizationId must not be empty",
      );
    },
  );

  it("total が 0 の場合は totalPages も 0 を受け入れる", async () => {
    server.use(
      http.get("/api/organizations/:id/members", () =>
        HttpResponse.json(
          createApiPaginatedSuccessResponse(
            { members: [] },
            { page: 1, perPage: 20, total: 0, totalPages: 0 },
          ),
          { status: 200 },
        ),
      ),
    );

    const result = await getOrganizationMembers({
      organizationId: "demo-org-001",
    });

    expect(result.totalPages).toBe(0);
  });

  it("total と totalPages の整合性が取れない meta はエラー", async () => {
    server.use(
      http.get("/api/organizations/:id/members", () =>
        HttpResponse.json(
          createApiPaginatedSuccessResponse(
            { members: [validMember] },
            { page: 1, perPage: 20, total: 41, totalPages: 1 },
          ),
          { status: 200 },
        ),
      ),
    );

    await expect(
      getOrganizationMembers({ organizationId: "demo-org-001" }),
    ).rejects.toBeInstanceOf(ApiResponseValidationError);
  });

  it.each([
    { field: "id", value: "" },
    { field: "userId", value: "" },
    { field: "email", value: "not-an-email" },
    { field: "joinedAt", value: "not-a-datetime" },
  ])("不正な $field を含むメンバー要素はエラー", async ({ field, value }) => {
    server.use(
      http.get("/api/organizations/:id/members", () =>
        HttpResponse.json(
          createApiPaginatedSuccessResponse(
            {
              members: [{ ...validMember, [field]: value }],
            },
            validMeta,
          ),
          { status: 200 },
        ),
      ),
    );

    await expect(
      getOrganizationMembers({ organizationId: "demo-org-001" }),
    ).rejects.toBeInstanceOf(ApiResponseValidationError);
  });

  it("不正な role を含むメンバー要素はエラー", async () => {
    server.use(
      http.get("/api/organizations/:id/members", () =>
        HttpResponse.json(
          createApiPaginatedSuccessResponse(
            {
              members: [{ ...validMember, role: "invalid-role" }],
            },
            validMeta,
          ),
          { status: 200 },
        ),
      ),
    );

    await expect(
      getOrganizationMembers({ organizationId: "demo-org-001" }),
    ).rejects.toBeInstanceOf(ApiResponseValidationError);
  });

  it("ラップなしレスポンスはエラー", async () => {
    server.use(
      http.get("/api/organizations/:id/members", () =>
        HttpResponse.json(
          { members: [validMember], meta: validMeta },
          { status: 200 },
        ),
      ),
    );

    await expect(
      getOrganizationMembers({ organizationId: "demo-org-001" }),
    ).rejects.toBeInstanceOf(ApiResponseValidationError);
  });

  it("不正な meta を含むレスポンスはエラー", async () => {
    server.use(
      http.get("/api/organizations/:id/members", () =>
        HttpResponse.json(
          createApiPaginatedSuccessResponse(
            { members: [validMember] },
            { page: Number.NaN, perPage: 20, total: 1, totalPages: 1 },
          ),
          { status: 200 },
        ),
      ),
    );

    await expect(
      getOrganizationMembers({ organizationId: "demo-org-001" }),
    ).rejects.toBeInstanceOf(ApiResponseValidationError);
  });

  it("HTTP エラーは ApiError として伝播する", async () => {
    server.use(
      http.get("/api/organizations/:id/members", () =>
        HttpResponse.json(
          createApiErrorResponse(ApiErrorCode.INTERNAL_ERROR, "サーバーエラー"),
          { status: 500 },
        ),
      ),
    );

    await expect(
      getOrganizationMembers({ organizationId: "demo-org-001" }),
    ).rejects.toSatisfy((error: unknown) => {
      return (
        error instanceof ApiError &&
        error.status === 500 &&
        error.message === "サーバーエラー"
      );
    });
  });

  it("AbortSignal で in-flight リクエストをキャンセルできる", async () => {
    server.use(
      http.get("/api/organizations/:id/members", () => {
        return new Promise(() => {
          // 決して解決しないことで、cancel 待ち状態を作る
        });
      }),
    );

    const controller = new AbortController();
    const promise = getOrganizationMembers({
      organizationId: "demo-org-001",
      signal: controller.signal,
    });
    controller.abort();

    await expect(promise).rejects.toSatisfy((error: unknown) => {
      return error instanceof DOMException && error.name === "AbortError";
    });
  });
});

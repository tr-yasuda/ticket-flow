import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { MAX_TICKET_SEARCH_LENGTH } from "../../../src/controllers/schemas/ticket-schema.js";
import { createApp } from "../../../src/routes/index.js";
import {
  cleanAll,
  createOrganization,
  createTicketRequest,
  registerUser,
  uniqueEmail,
} from "../helpers/organization-test-helpers.js";

async function searchTicketsRequest(
  app: ReturnType<typeof createApp>,
  accessToken: string,
  organizationId: string,
  search: string,
  query: Record<string, string> = {},
): Promise<Response> {
  const params = new URLSearchParams(query);
  params.set("search", search);
  const url = `/api/organizations/${organizationId}/tickets?${params.toString()}`;
  return app.request(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

describe("GET /api/organizations/:organizationId/tickets?search=... (tickets.search)", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    await cleanAll();
    app = createApp();
  });
  afterAll(async () => {
    await cleanAll();
  });

  it("タイトルにキーワードを含むチケットを返す", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "billing issue",
      description: "description",
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "ui bug",
      description: "other",
    });

    const response = await searchTicketsRequest(
      app,
      ownerToken,
      organizationId,
      "billing",
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(1);
    expect(body.data.tickets[0]?.title).toBe("billing issue");
    expect(body.meta.total).toBe(1);
  });

  it("説明にキーワードを含むチケットを返す", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "title only",
      description: "hidden keyword here",
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "no match",
      description: "nothing relevant",
    });

    const response = await searchTicketsRequest(
      app,
      ownerToken,
      organizationId,
      "keyword",
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(1);
    expect(body.data.tickets[0]?.title).toBe("title only");
  });

  it("大文字小文字を区別しない検索", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "UPPERCASE TITLE",
    });

    const response = await searchTicketsRequest(
      app,
      ownerToken,
      organizationId,
      "uppercase",
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(1);
  });

  it("検索結果もページネーション対応", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "searchable first",
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "searchable second",
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "unrelated",
    });

    const response = await searchTicketsRequest(
      app,
      ownerToken,
      organizationId,
      "searchable",
      { page: "1", perPage: "1" },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(1);
    expect(body.meta).toMatchObject({
      page: 1,
      perPage: 1,
      total: 2,
      totalPages: 2,
    });
  });

  it("他組織のチケットは含まれない", async () => {
    const { accessToken: ownerAToken } = await registerUser(
      app,
      uniqueEmail("owner-a"),
      "password123",
    );
    const { accessToken: ownerBToken } = await registerUser(
      app,
      uniqueEmail("owner-b"),
      "password123",
    );
    const organizationAId = await createOrganization(
      app,
      ownerAToken,
      "Org A",
      "org-a",
    );
    const organizationBId = await createOrganization(
      app,
      ownerBToken,
      "Org B",
      "org-b",
    );
    await createTicketRequest(app, ownerAToken, organizationAId, {
      title: "shared keyword a",
    });
    await createTicketRequest(app, ownerBToken, organizationBId, {
      title: "shared keyword b",
    });

    const response = await searchTicketsRequest(
      app,
      ownerAToken,
      organizationAId,
      "shared",
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(1);
    expect(body.data.tickets[0]?.title).toBe("shared keyword a");
  });

  it("空文字の検索は全件返す", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "first",
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "second",
    });

    const response = await searchTicketsRequest(
      app,
      ownerToken,
      organizationId,
      "",
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(2);
  });

  it("空白のみの検索は全件返す", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "first",
    });

    const response = await searchTicketsRequest(
      app,
      ownerToken,
      organizationId,
      "   ",
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(1);
  });

  it("SQL インジェクションの試行は文字列として扱われ安全", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "safe title",
    });

    const response = await searchTicketsRequest(
      app,
      ownerToken,
      organizationId,
      "' OR '1'='1",
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(0);
  });

  it("LIKE ワイルドカード % は文字列として扱われる", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "50% discount",
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "50x discount",
    });

    const response = await searchTicketsRequest(
      app,
      ownerToken,
      organizationId,
      "50%",
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(1);
    expect(body.data.tickets[0]?.title).toBe("50% discount");
  });

  it("LIKE ワイルドカード _ は文字列として扱われる", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "file_1",
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "fileA1",
    });

    const response = await searchTicketsRequest(
      app,
      ownerToken,
      organizationId,
      "file_1",
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(1);
    expect(body.data.tickets[0]?.title).toBe("file_1");
  });

  it("検索結果が 0 件の場合 totalPages は 1", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "existing",
    });

    const response = await searchTicketsRequest(
      app,
      ownerToken,
      organizationId,
      "notfound",
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toEqual([]);
    expect(body.meta).toMatchObject({
      page: 1,
      perPage: 20,
      total: 0,
      totalPages: 1,
    });
  });

  it(`search は ${MAX_TICKET_SEARCH_LENGTH} 文字まで許可`, async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );

    const validSearch = "a".repeat(MAX_TICKET_SEARCH_LENGTH);
    const response = await searchTicketsRequest(
      app,
      ownerToken,
      organizationId,
      validSearch,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  it(`search が ${MAX_TICKET_SEARCH_LENGTH + 1} 文字の場合 400`, async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );

    const tooLongSearch = "a".repeat(MAX_TICKET_SEARCH_LENGTH + 1);
    const response = await searchTicketsRequest(
      app,
      ownerToken,
      organizationId,
      tooLongSearch,
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "search" })]),
    );
  });
});

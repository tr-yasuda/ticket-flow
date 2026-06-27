import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../../src/routes/index.js";
import {
  cleanAll,
  createOrganization,
  createTicketRequest,
  registerUser,
  uniqueEmail,
} from "../helpers/organization-test-helpers.js";

async function filterTicketsRequest(
  app: ReturnType<typeof createApp>,
  accessToken: string,
  organizationId: string,
  query: Record<string, string> = {},
): Promise<Response> {
  const params = new URLSearchParams(query);
  const url = `/api/organizations/${organizationId}/tickets?${params.toString()}`;
  return app.request(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

async function updateTicketStatusRequest(
  app: ReturnType<typeof createApp>,
  accessToken: string,
  organizationId: string,
  ticketId: string,
  status: string,
): Promise<Response> {
  return app.request(
    `/api/organizations/${organizationId}/tickets/${ticketId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
}

describe("GET /api/organizations/:organizationId/tickets?status=... (tickets.filter.status)", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    await cleanAll();
    app = createApp();
  });
  afterAll(async () => {
    await cleanAll();
  });

  it("単一ステータスでフィルタできる", async () => {
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
      title: "open ticket",
    });
    const inProgressTicket = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      {
        title: "in progress ticket",
      },
    );
    const inProgressBody = await inProgressTicket.json();
    await updateTicketStatusRequest(
      app,
      ownerToken,
      organizationId,
      inProgressBody.data.id,
      "in-progress",
    );
    const closedTicket = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      {
        title: "closed ticket",
      },
    );
    const closedBody = await closedTicket.json();
    await updateTicketStatusRequest(
      app,
      ownerToken,
      organizationId,
      closedBody.data.id,
      "closed",
    );

    const response = await filterTicketsRequest(
      app,
      ownerToken,
      organizationId,
      {
        status: "open",
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(1);
    expect(body.data.tickets[0]?.title).toBe("open ticket");
    expect(body.meta.total).toBe(1);
  });

  it("複数ステータスを OR 条件で指定できる", async () => {
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
      title: "open ticket",
    });
    const inProgressTicket = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      {
        title: "in progress ticket",
      },
    );
    const inProgressBody = await inProgressTicket.json();
    await updateTicketStatusRequest(
      app,
      ownerToken,
      organizationId,
      inProgressBody.data.id,
      "in-progress",
    );
    const closedTicket = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      {
        title: "closed ticket",
      },
    );
    const closedBody = await closedTicket.json();
    await updateTicketStatusRequest(
      app,
      ownerToken,
      organizationId,
      closedBody.data.id,
      "closed",
    );

    const response = await filterTicketsRequest(
      app,
      ownerToken,
      organizationId,
      {
        status: "open,in-progress",
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(2);
    const titles = body.data.tickets.map(
      (ticket: { title: string }) => ticket.title,
    );
    expect(titles).toContain("open ticket");
    expect(titles).toContain("in progress ticket");
    expect(titles).not.toContain("closed ticket");
    expect(body.meta.total).toBe(2);
  });

  it("無効なステータス値は無視される", async () => {
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
      title: "open ticket",
    });

    const response = await filterTicketsRequest(
      app,
      ownerToken,
      organizationId,
      {
        status: "invalid",
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(1);
    expect(body.data.tickets[0]?.title).toBe("open ticket");
  });

  it("有効な値と無効な値が混在する場合、有効な値のみ適用される", async () => {
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
      title: "open ticket",
    });
    const closedTicket = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      {
        title: "closed ticket",
      },
    );
    const closedBody = await closedTicket.json();
    await updateTicketStatusRequest(
      app,
      ownerToken,
      organizationId,
      closedBody.data.id,
      "closed",
    );

    const response = await filterTicketsRequest(
      app,
      ownerToken,
      organizationId,
      {
        status: "open,invalid",
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(1);
    expect(body.data.tickets[0]?.title).toBe("open ticket");
  });

  it("すべて無効なステータス値の場合はフィルタが解除される", async () => {
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
      title: "open ticket",
    });
    const closedTicket = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      {
        title: "closed ticket",
      },
    );
    const closedBody = await closedTicket.json();
    await updateTicketStatusRequest(
      app,
      ownerToken,
      organizationId,
      closedBody.data.id,
      "closed",
    );

    const response = await filterTicketsRequest(
      app,
      ownerToken,
      organizationId,
      {
        status: "invalid1,invalid2",
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(2);
    expect(body.meta.total).toBe(2);
  });

  it("status クエリがない場合は全件返す", async () => {
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
      title: "open ticket",
    });
    const closedTicket = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      {
        title: "closed ticket",
      },
    );
    const closedBody = await closedTicket.json();
    await updateTicketStatusRequest(
      app,
      ownerToken,
      organizationId,
      closedBody.data.id,
      "closed",
    );

    const response = await filterTicketsRequest(
      app,
      ownerToken,
      organizationId,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(2);
    expect(body.meta.total).toBe(2);
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
      title: "org a open ticket",
    });
    await createTicketRequest(app, ownerBToken, organizationBId, {
      title: "org b open ticket",
    });

    const response = await filterTicketsRequest(
      app,
      ownerAToken,
      organizationAId,
      {
        status: "open",
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(1);
    expect(body.data.tickets[0]?.title).toBe("org a open ticket");
    expect(body.meta.total).toBe(1);
  });

  it("status と search を組み合わせてフィルタできる", async () => {
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
      title: "billing open",
    });
    const closedTicket = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      {
        title: "billing closed",
      },
    );
    const closedBody = await closedTicket.json();
    await updateTicketStatusRequest(
      app,
      ownerToken,
      organizationId,
      closedBody.data.id,
      "closed",
    );
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "other open",
    });

    const response = await filterTicketsRequest(
      app,
      ownerToken,
      organizationId,
      {
        search: "billing",
        status: "open",
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(1);
    expect(body.data.tickets[0]?.title).toBe("billing open");
    expect(body.meta.total).toBe(1);
  });

  it("ページネーションと status フィルタを組み合わせられる", async () => {
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
      title: "open first",
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "open second",
    });
    const closedTicket = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      {
        title: "closed ticket",
      },
    );
    const closedBody = await closedTicket.json();
    await updateTicketStatusRequest(
      app,
      ownerToken,
      organizationId,
      closedBody.data.id,
      "closed",
    );

    const response = await filterTicketsRequest(
      app,
      ownerToken,
      organizationId,
      {
        status: "open",
        perPage: "1",
      },
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
});

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../../src/routes/index.js";
import {
  addMember,
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
  query: Record<string, string | string[]> = {},
): Promise<Response> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item);
      }
    } else {
      params.set(key, value);
    }
  }
  const url = `/api/organizations/${organizationId}/tickets?${params.toString()}`;
  return app.request(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

describe("GET /api/organizations/:organizationId/tickets?priority=... (tickets.filter.priority)", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    await cleanAll();
    app = createApp();
  });
  afterAll(async () => {
    await cleanAll();
  });

  it("単一優先度でフィルタできる", async () => {
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
      title: "low priority ticket",
      priority: "low",
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "high priority ticket",
      priority: "high",
    });

    const response = await filterTicketsRequest(
      app,
      ownerToken,
      organizationId,
      {
        priority: "high",
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(1);
    expect(body.data.tickets[0]?.title).toBe("high priority ticket");
    expect(body.meta.total).toBe(1);
  });

  it("複数優先度を OR 条件で指定できる", async () => {
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
      title: "low priority ticket",
      priority: "low",
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "high priority ticket",
      priority: "high",
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "urgent priority ticket",
      priority: "urgent",
    });

    const response = await filterTicketsRequest(
      app,
      ownerToken,
      organizationId,
      {
        priority: "high,urgent",
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(2);
    const titles = body.data.tickets.map(
      (ticket: { title: string }) => ticket.title,
    );
    expect(titles).toContain("high priority ticket");
    expect(titles).toContain("urgent priority ticket");
    expect(titles).not.toContain("low priority ticket");
    expect(body.meta.total).toBe(2);
  });

  it("無効な優先度値は無視される", async () => {
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
      title: "high priority ticket",
      priority: "high",
    });

    const response = await filterTicketsRequest(
      app,
      ownerToken,
      organizationId,
      {
        priority: "invalid",
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(1);
    expect(body.data.tickets[0]?.title).toBe("high priority ticket");
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
      title: "high priority ticket",
      priority: "high",
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "low priority ticket",
      priority: "low",
    });

    const response = await filterTicketsRequest(
      app,
      ownerToken,
      organizationId,
      {
        priority: "high,invalid",
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(1);
    expect(body.data.tickets[0]?.title).toBe("high priority ticket");
  });

  it("すべて無効な優先度値の場合はフィルタが解除される", async () => {
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
      title: "high priority ticket",
      priority: "high",
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "low priority ticket",
      priority: "low",
    });

    const response = await filterTicketsRequest(
      app,
      ownerToken,
      organizationId,
      {
        priority: "invalid1,invalid2",
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(2);
    expect(body.meta.total).toBe(2);
  });

  it("priority クエリがない場合は全件返す", async () => {
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
      title: "high priority ticket",
      priority: "high",
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "low priority ticket",
      priority: "low",
    });

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
      title: "org a high priority ticket",
      priority: "high",
    });
    await createTicketRequest(app, ownerBToken, organizationBId, {
      title: "org b high priority ticket",
      priority: "high",
    });

    const response = await filterTicketsRequest(
      app,
      ownerAToken,
      organizationAId,
      {
        priority: "high",
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(1);
    expect(body.data.tickets[0]?.title).toBe("org a high priority ticket");
    expect(body.meta.total).toBe(1);
  });

  it("priority と search を組み合わせてフィルタできる", async () => {
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
      title: "billing high",
      priority: "high",
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "billing low",
      priority: "low",
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "ui high",
      priority: "high",
    });

    const response = await filterTicketsRequest(
      app,
      ownerToken,
      organizationId,
      {
        search: "billing",
        priority: "high",
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(1);
    expect(body.data.tickets[0]?.title).toBe("billing high");
    expect(body.meta.total).toBe(1);
  });

  it("priority と status を組み合わせてフィルタできる", async () => {
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
      title: "open high",
      priority: "high",
    });
    const closedHighTicket = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      {
        title: "closed high",
        priority: "high",
      },
    );
    const closedHighBody = await closedHighTicket.json();
    await app.request(
      `/api/organizations/${organizationId}/tickets/${closedHighBody.data.id}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "closed" }),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
      },
    );
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "open low",
      priority: "low",
    });

    const response = await filterTicketsRequest(
      app,
      ownerToken,
      organizationId,
      {
        status: "open",
        priority: "high",
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(1);
    expect(body.data.tickets[0]?.title).toBe("open high");
    expect(body.meta.total).toBe(1);
  });

  it("ページネーションと priority フィルタを組み合わせられる", async () => {
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
      title: "high first",
      priority: "high",
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "high second",
      priority: "high",
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "low ticket",
      priority: "low",
    });

    const response = await filterTicketsRequest(
      app,
      ownerToken,
      organizationId,
      {
        priority: "high",
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

  it("繰り返しクエリパラメータで複数優先度を指定できる", async () => {
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
      title: "low priority ticket",
      priority: "low",
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "high priority ticket",
      priority: "high",
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "urgent priority ticket",
      priority: "urgent",
    });

    const response = await filterTicketsRequest(
      app,
      ownerToken,
      organizationId,
      {
        priority: ["high", "urgent"],
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(2);
    const titles = body.data.tickets.map(
      (ticket: { title: string }) => ticket.title,
    );
    expect(titles).toContain("high priority ticket");
    expect(titles).toContain("urgent priority ticket");
    expect(titles).not.toContain("low priority ticket");
    expect(body.meta.total).toBe(2);
  });

  it("priority を指定しないで作成したチケットは medium フィルタで返る", async () => {
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
      title: "default priority ticket",
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "high priority ticket",
      priority: "high",
    });

    const response = await filterTicketsRequest(
      app,
      ownerToken,
      organizationId,
      {
        priority: "medium",
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(1);
    expect(body.data.tickets[0]?.title).toBe("default priority ticket");
    expect(body.meta.total).toBe(1);
  });

  it("有効な priority でも一致しない場合は 0 件を返す", async () => {
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
      title: "low priority ticket",
      priority: "low",
    });

    const response = await filterTicketsRequest(
      app,
      ownerToken,
      organizationId,
      {
        priority: "high",
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(0);
    expect(body.meta.total).toBe(0);
  });

  it("priority と assignee を組み合わせてフィルタできる", async () => {
    const { accessToken: ownerToken, userId: ownerId } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const { userId: memberId } = await registerUser(
      app,
      uniqueEmail("member"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );
    await addMember(organizationId, memberId, "member");

    await createTicketRequest(app, ownerToken, organizationId, {
      title: "owner high",
      priority: "high",
      assigneeId: ownerId,
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "member high",
      priority: "high",
      assigneeId: memberId,
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "owner low",
      priority: "low",
      assigneeId: ownerId,
    });

    const response = await filterTicketsRequest(
      app,
      ownerToken,
      organizationId,
      {
        priority: "high",
        assignee: ownerId,
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(1);
    expect(body.data.tickets[0]?.title).toBe("owner high");
    expect(body.meta.total).toBe(1);
  });

  it("priority と assignee=none を組み合わせてフィルタできる", async () => {
    const { accessToken: ownerToken, userId: ownerId } = await registerUser(
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
      title: "unassigned high",
      priority: "high",
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "unassigned low",
      priority: "low",
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "assigned high",
      priority: "high",
      assigneeId: ownerId,
    });

    const response = await filterTicketsRequest(
      app,
      ownerToken,
      organizationId,
      {
        priority: "high",
        assignee: "none",
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(1);
    expect(body.data.tickets[0]?.title).toBe("unassigned high");
    expect(body.meta.total).toBe(1);
  });

  it("search と無効な priority を組み合わせてもフィルタが解除される", async () => {
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
      title: "billing high",
      priority: "high",
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "billing low",
      priority: "low",
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "ui high",
      priority: "high",
    });

    const response = await filterTicketsRequest(
      app,
      ownerToken,
      organizationId,
      {
        search: "billing",
        priority: "invalid",
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(2);
    const titles = body.data.tickets.map(
      (ticket: { title: string }) => ticket.title,
    );
    expect(titles).toContain("billing high");
    expect(titles).toContain("billing low");
    expect(body.meta.total).toBe(2);
  });
});

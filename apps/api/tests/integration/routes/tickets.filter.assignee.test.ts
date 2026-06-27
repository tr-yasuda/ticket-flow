import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../../../src/lib/prisma.js";
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
      params.append(key, value);
    }
  }
  const url = `/api/organizations/${organizationId}/tickets?${params.toString()}`;
  return app.request(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

describe("GET /api/organizations/:organizationId/tickets?assignee=... (tickets.filter.assignee)", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    await cleanAll();
    app = createApp();
  });
  afterAll(async () => {
    await cleanAll();
  });

  it("指定した担当者のチケットだけを返す", async () => {
    const { accessToken: ownerToken } = await registerUser(
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
      title: "owner ticket",
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "member ticket",
      assigneeId: memberId,
    });

    const response = await filterTicketsRequest(
      app,
      ownerToken,
      organizationId,
      {
        assignee: memberId,
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(1);
    expect(body.data.tickets[0]?.title).toBe("member ticket");
    expect(body.meta.total).toBe(1);
  });

  it("assignee=none で未アサインのチケットだけを返す", async () => {
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
      title: "assigned ticket",
      assigneeId: ownerId,
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "unassigned ticket",
    });

    const response = await filterTicketsRequest(
      app,
      ownerToken,
      organizationId,
      {
        assignee: "none",
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(1);
    expect(body.data.tickets[0]?.title).toBe("unassigned ticket");
    expect(body.meta.total).toBe(1);
  });

  it("自分が担当しているチケットだけを表示できる", async () => {
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
      title: "my ticket",
      assigneeId: ownerId,
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "other ticket",
    });

    const response = await filterTicketsRequest(
      app,
      ownerToken,
      organizationId,
      {
        assignee: ownerId,
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(1);
    expect(body.data.tickets[0]?.title).toBe("my ticket");
    expect(body.meta.total).toBe(1);
  });

  it("組織に所属していないユーザーを指定すると空結果を返す", async () => {
    const { accessToken: ownerToken } = await registerUser(
      app,
      uniqueEmail("owner"),
      "password123",
    );
    const { userId: outsiderId } = await registerUser(
      app,
      uniqueEmail("outsider"),
      "password123",
    );
    const organizationId = await createOrganization(
      app,
      ownerToken,
      "Acme Inc.",
      "acme-inc",
    );

    const ticketResponse = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      {
        title: "ticket",
      },
    );
    const ticketBody = await ticketResponse.json();
    await prisma.ticket.update({
      where: { id: ticketBody.data.id },
      data: { assigneeId: outsiderId },
    });

    const response = await filterTicketsRequest(
      app,
      ownerToken,
      organizationId,
      {
        assignee: outsiderId,
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(0);
    expect(body.meta.total).toBe(0);
  });

  it("他組織のチケットは含まれない", async () => {
    const { accessToken: ownerAToken, userId: ownerAId } = await registerUser(
      app,
      uniqueEmail("owner-a"),
      "password123",
    );
    const { accessToken: ownerBToken, userId: ownerBId } = await registerUser(
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
      title: "org a ticket",
      assigneeId: ownerAId,
    });
    await createTicketRequest(app, ownerBToken, organizationBId, {
      title: "org b ticket",
      assigneeId: ownerBId,
    });

    const response = await filterTicketsRequest(
      app,
      ownerAToken,
      organizationAId,
      {
        assignee: ownerAId,
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(1);
    expect(body.data.tickets[0]?.title).toBe("org a ticket");
    expect(body.meta.total).toBe(1);
  });

  it("assignee と status を組み合わせてフィルタできる", async () => {
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
      title: "open assigned",
      assigneeId: ownerId,
    });
    const closedAssigned = await createTicketRequest(
      app,
      ownerToken,
      organizationId,
      {
        title: "closed assigned",
        assigneeId: ownerId,
      },
    );
    const closedAssignedBody = await closedAssigned.json();
    await app.request(
      `/api/organizations/${organizationId}/tickets/${closedAssignedBody.data.id}/status`,
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
      title: "open unassigned",
    });

    const response = await filterTicketsRequest(
      app,
      ownerToken,
      organizationId,
      {
        assignee: ownerId,
        status: "open",
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(1);
    expect(body.data.tickets[0]?.title).toBe("open assigned");
    expect(body.meta.total).toBe(1);
  });

  it("assignee と search を組み合わせてフィルタできる", async () => {
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
      title: "billing assigned",
      description: "billing",
      assigneeId: ownerId,
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "billing unassigned",
      description: "billing",
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "ui assigned",
      description: "ui",
      assigneeId: ownerId,
    });

    const response = await filterTicketsRequest(
      app,
      ownerToken,
      organizationId,
      {
        assignee: ownerId,
        search: "billing",
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(1);
    expect(body.data.tickets[0]?.title).toBe("billing assigned");
    expect(body.meta.total).toBe(1);
  });

  it("assignee とページネーションを組み合わせられる", async () => {
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
      title: "assigned first",
      assigneeId: ownerId,
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "assigned second",
      assigneeId: ownerId,
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "unassigned",
    });

    const response = await filterTicketsRequest(
      app,
      ownerToken,
      organizationId,
      {
        assignee: ownerId,
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

  it("assignee=NONE でも未アサインを絞り込める", async () => {
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
      title: "assigned ticket",
      assigneeId: ownerId,
    });
    await createTicketRequest(app, ownerToken, organizationId, {
      title: "unassigned ticket",
    });

    const response = await filterTicketsRequest(
      app,
      ownerToken,
      organizationId,
      {
        assignee: "NONE",
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.tickets).toHaveLength(1);
    expect(body.data.tickets[0]?.title).toBe("unassigned ticket");
  });

  it("担当者IDの形式が不正な場合は 400 を返す", async () => {
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

    const response = await filterTicketsRequest(
      app,
      ownerToken,
      organizationId,
      {
        assignee: "not-a-uuid",
      },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "assignee" })]),
    );
  });
});

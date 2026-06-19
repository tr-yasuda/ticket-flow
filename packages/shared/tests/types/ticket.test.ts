import { describe, expect, it } from "vitest";

import { createTicket, formatTicket } from "../../src/index.js";

describe("createTicket", () => {
  it("指定した id / organizationId / title / createdBy で open 状態のチケットを作成する", () => {
    const ticket = createTicket("T-001", "org-1", "初期対応", "user-1");

    expect(ticket).toStrictEqual({
      id: "T-001",
      organizationId: "org-1",
      title: "初期対応",
      description: null,
      status: "open",
      priority: "medium",
      assigneeId: null,
      createdBy: "user-1",
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
  });
});

describe("formatTicket", () => {
  it("ステータスと id と title を含む文字列を返す", () => {
    const ticket = createTicket("T-002", "org-1", "不具合調査", "user-1");

    expect(formatTicket(ticket)).toBe("[open] T-002: 不具合調査");
  });
});

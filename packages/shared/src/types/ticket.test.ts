import { describe, expect, it } from "vitest";

import { createTicket, formatTicket } from "./ticket.js";

describe("createTicket", () => {
  it("指定した id と title で open 状態のチケットを作成する", () => {
    const ticket = createTicket("T-001", "初期対応");

    expect(ticket).toStrictEqual({
      id: "T-001",
      title: "初期対応",
      status: "open",
    });
  });
});

describe("formatTicket", () => {
  it("ステータスと id と title を含む文字列を返す", () => {
    const ticket = createTicket("T-002", "不具合調査");

    expect(formatTicket(ticket)).toBe("[open] T-002: 不具合調査");
  });
});

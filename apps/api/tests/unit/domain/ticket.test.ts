import { describe, expect, it } from "vitest";

import { createTicket, rehydrateTicket } from "../../../src/domain/ticket";

describe("チケット作成", () => {
  it("有効な id と title でチケットが作成できる", () => {
    const ticket = createTicket("ticket-1", "バグを修正する");

    expect(ticket).toEqual({
      id: "ticket-1",
      title: "バグを修正する",
      status: "open",
    });
  });

  it.each([
    ["空文字", ""],
    ["空白のみ", "   "],
    ["タブと改行のみ", "\t\n"],
    ["全角スペースのみ", "　"],
  ])("%s の id は拒否される", (_label, id) => {
    expect(() => createTicket(id, "バグを修正する")).toThrow(
      "Ticket id is required",
    );
  });

  it.each([
    ["空文字", ""],
    ["空白のみ", "   "],
    ["タブと改行のみ", "\t\n"],
    ["全角スペースのみ", "　"],
  ])("%s の title は拒否される", (_label, title) => {
    expect(() => createTicket("ticket-1", title)).toThrow(
      "Ticket title is required",
    );
  });

  it("200 文字の title は許容される", () => {
    const title = "a".repeat(200);

    expect(() => createTicket("ticket-1", title)).not.toThrow();
  });

  it("201 文字の title は拒否される", () => {
    const title = "a".repeat(201);

    expect(() => createTicket("ticket-1", title)).toThrow(
      "Ticket title must be 200 characters or fewer",
    );
  });

  it("前後の空白を除いた長さで title の上限を判定する", () => {
    const title = `  ${"a".repeat(201)}  `;

    expect(() => createTicket("ticket-1", title)).toThrow(
      "Ticket title must be 200 characters or fewer",
    );
  });
});

describe("チケット復元", () => {
  it("有効な status でチケットを復元できる", () => {
    const ticket = rehydrateTicket("ticket-1", "バグを修正する", "in-progress");

    expect(ticket).toEqual({
      id: "ticket-1",
      title: "バグを修正する",
      status: "in-progress",
    });
  });

  it.each([
    ["無効な文字列", "invalid"],
    ["空文字", ""],
    ["大文字", "OPEN"],
  ])("%s の status は拒否される", (_label, status) => {
    expect(() => rehydrateTicket("ticket-1", "バグを修正する", status)).toThrow(
      `Invalid ticket status: ${status}`,
    );
  });
});

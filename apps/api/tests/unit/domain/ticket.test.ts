import { describe, expect, it } from "vitest";

import {
  TicketPriority,
  TicketStatus,
  TicketValidationError,
  createTicket,
  rehydrateTicket,
} from "../../../src/domain/ticket.js";

describe("チケット作成", () => {
  it("有効な入力でチケットが作成できる", () => {
    const ticket = createTicket({
      organizationId: "org-1",
      title: "バグを修正する",
      createdBy: "user-1",
    });

    expect(ticket).toEqual({
      id: expect.any(String),
      organizationId: "org-1",
      title: "バグを修正する",
      description: null,
      status: TicketStatus.Open,
      priority: TicketPriority.Medium,
      assigneeId: null,
      createdBy: "user-1",
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
    expect(ticket.createdAt.getTime()).toBe(ticket.updatedAt.getTime());
  });

  it("description と priority と assigneeId を指定できる", () => {
    const ticket = createTicket({
      organizationId: "org-1",
      title: "バグを修正する",
      description: "再現手順を記載する",
      priority: TicketPriority.High,
      assigneeId: "user-2",
      createdBy: "user-1",
    });

    expect(ticket.description).toBe("再現手順を記載する");
    expect(ticket.priority).toBe(TicketPriority.High);
    expect(ticket.assigneeId).toBe("user-2");
  });

  it("タイトルの前後の空白は削除される", () => {
    const ticket = createTicket({
      organizationId: "org-1",
      title: "  バグを修正する  ",
      createdBy: "user-1",
    });

    expect(ticket.title).toBe("バグを修正する");
  });

  it("説明の前後の空白は削除される", () => {
    const ticket = createTicket({
      organizationId: "org-1",
      title: "バグを修正する",
      description: "  再現手順  ",
      createdBy: "user-1",
    });

    expect(ticket.description).toBe("再現手順");
  });

  it("空の説明は null として保存される", () => {
    const ticket = createTicket({
      organizationId: "org-1",
      title: "バグを修正する",
      description: "   ",
      createdBy: "user-1",
    });

    expect(ticket.description).toBeNull();
  });

  it.each([
    ["空文字", ""],
    ["空白のみ", "   "],
    ["タブと改行のみ", "\t\n"],
    ["全角スペースのみ", "　"],
  ])("%s の組織ID は拒否される", (_label, organizationId) => {
    expect(() =>
      createTicket({
        organizationId,
        title: "バグを修正する",
        createdBy: "user-1",
      }),
    ).toThrow(TicketValidationError);
  });

  it.each([
    ["空文字", ""],
    ["空白のみ", "   "],
    ["タブと改行のみ", "\t\n"],
    ["全角スペースのみ", "　"],
  ])("%s のタイトル は拒否される", (_label, title) => {
    expect(() =>
      createTicket({
        organizationId: "org-1",
        title,
        createdBy: "user-1",
      }),
    ).toThrow(TicketValidationError);
  });

  it.each([
    ["空文字", ""],
    ["空白のみ", "   "],
    ["タブと改行のみ", "\t\n"],
    ["全角スペースのみ", "　"],
  ])("%s の作成者ID は拒否される", (_label, createdBy) => {
    expect(() =>
      createTicket({
        organizationId: "org-1",
        title: "バグを修正する",
        createdBy,
      }),
    ).toThrow(TicketValidationError);
  });

  it.each([
    ["空文字", ""],
    ["空白のみ", "   "],
    ["タブと改行のみ", "\t\n"],
    ["全角スペースのみ", "　"],
  ])("%s の担当者ID は拒否される", (_label, assigneeId) => {
    expect(() =>
      createTicket({
        organizationId: "org-1",
        title: "バグを修正する",
        assigneeId,
        createdBy: "user-1",
      }),
    ).toThrow(TicketValidationError);
  });

  it("200 文字のタイトルは許容される", () => {
    const title = "a".repeat(200);

    expect(() =>
      createTicket({
        organizationId: "org-1",
        title,
        createdBy: "user-1",
      }),
    ).not.toThrow();
  });

  it("201 文字のタイトルは拒否される", () => {
    const title = "a".repeat(201);

    expect(() =>
      createTicket({
        organizationId: "org-1",
        title,
        createdBy: "user-1",
      }),
    ).toThrow(TicketValidationError);
  });

  it("前後の空白を除いた長さでタイトルの上限を判定する", () => {
    const title = `  ${"a".repeat(201)}  `;

    expect(() =>
      createTicket({
        organizationId: "org-1",
        title,
        createdBy: "user-1",
      }),
    ).toThrow(TicketValidationError);
  });

  it("10000 文字以内の説明は許容される", () => {
    expect(() =>
      createTicket({
        organizationId: "org-1",
        title: "バグを修正する",
        description: "a".repeat(10000),
        createdBy: "user-1",
      }),
    ).not.toThrow();
  });

  it("10001 文字の説明は拒否される", () => {
    expect(() =>
      createTicket({
        organizationId: "org-1",
        title: "バグを修正する",
        description: "a".repeat(10001),
        createdBy: "user-1",
      }),
    ).toThrow(TicketValidationError);
  });
});

describe("チケット復元", () => {
  it("有効な値でチケットを復元できる", () => {
    const input = {
      id: "ticket-1",
      organizationId: "org-1",
      title: "バグを修正する",
      description: "再現手順" as string | null,
      status: TicketStatus.InProgress,
      priority: TicketPriority.High,
      assigneeId: "user-2" as string | null,
      createdBy: "user-1",
      createdAt: new Date("2026-06-19T00:00:00.000Z"),
      updatedAt: new Date("2026-06-19T01:00:00.000Z"),
    };

    const ticket = rehydrateTicket(input);

    expect(ticket).toEqual(input);
  });

  it.each([
    ["無効な文字列", "invalid"],
    ["空文字", ""],
    ["大文字", "OPEN"],
  ])("%s の status は拒否される", (_label, status) => {
    expect(() =>
      rehydrateTicket({
        id: "ticket-1",
        organizationId: "org-1",
        title: "バグを修正する",
        description: null,
        status,
        priority: TicketPriority.Medium,
        assigneeId: null,
        createdBy: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).toThrow(TicketValidationError);
  });

  it.each([
    ["無効な文字列", "invalid"],
    ["空文字", ""],
    ["大文字", "HIGH"],
  ])("%s の priority は拒否される", (_label, priority) => {
    expect(() =>
      rehydrateTicket({
        id: "ticket-1",
        organizationId: "org-1",
        title: "バグを修正する",
        description: null,
        status: TicketStatus.Open,
        priority,
        assigneeId: null,
        createdBy: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).toThrow(TicketValidationError);
  });
});

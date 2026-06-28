import { describe, expect, it } from "vitest";

import {
  TicketInvalidStateError,
  TicketPriority,
  TicketStatus,
  TicketValidationError,
  createTicket,
  parseTicketPriority,
  parseTicketStatus,
  rehydrateTicket,
  updateTicket,
  updateTicketAssignee,
  updateTicketPriority,
  updateTicketStatus,
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
      deletedAt: null,
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

  it("組織IDの前後の空白は削除される", () => {
    const ticket = createTicket({
      organizationId: "  org-1  ",
      title: "バグを修正する",
      createdBy: "user-1",
    });

    expect(ticket.organizationId).toBe("org-1");
  });

  it("作成者IDの前後の空白は削除される", () => {
    const ticket = createTicket({
      organizationId: "org-1",
      title: "バグを修正する",
      createdBy: "  user-1  ",
    });

    expect(ticket.createdBy).toBe("user-1");
  });

  it("担当者IDの前後の空白は削除される", () => {
    const ticket = createTicket({
      organizationId: "org-1",
      title: "バグを修正する",
      assigneeId: "  user-2  ",
      createdBy: "user-1",
    });

    expect(ticket.assigneeId).toBe("user-2");
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
      deletedAt: null,
    };

    const ticket = rehydrateTicket(input);

    expect(ticket).toEqual(input);
  });

  it("復元時に ID 系フィールドの前後の空白を削除する", () => {
    const ticket = rehydrateTicket({
      id: "ticket-1",
      organizationId: "  org-1  ",
      title: "  バグを修正する  ",
      description: "  再現手順  ",
      status: TicketStatus.Open,
      priority: TicketPriority.Medium,
      assigneeId: "  user-2  ",
      createdBy: "  user-1  ",
      createdAt: new Date("2026-06-19T00:00:00.000Z"),
      updatedAt: new Date("2026-06-19T01:00:00.000Z"),
    });

    expect(ticket.organizationId).toBe("org-1");
    expect(ticket.createdBy).toBe("user-1");
    expect(ticket.assigneeId).toBe("user-2");
    expect(ticket.title).toBe("バグを修正する");
    expect(ticket.description).toBe("再現手順");
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

describe("チケット更新", () => {
  function baseTicket() {
    return createTicket({
      organizationId: "org-1",
      title: "バグを修正する",
      createdBy: "user-1",
    });
  }

  it("タイトルを更新できる", () => {
    const ticket = baseTicket();
    const updated = updateTicket(ticket, { title: "新しいタイトル" });

    expect(updated.title).toBe("新しいタイトル");
    expect(updated.description).toBe(ticket.description);
    expect(updated.priority).toBe(ticket.priority);
    expect(updated.assigneeId).toBe(ticket.assigneeId);
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
      ticket.updatedAt.getTime(),
    );
  });

  it("description を省略すると既存値が保持される", () => {
    const ticket = createTicket({
      organizationId: "org-1",
      title: "バグ",
      description: "説明",
      createdBy: "user-1",
    });
    const updated = updateTicket(ticket, { title: "新しいタイトル" });

    expect(updated.description).toBe("説明");
  });

  it("説明を空文字にすると null になる", () => {
    const ticket = createTicket({
      organizationId: "org-1",
      title: "バグ",
      description: "説明",
      createdBy: "user-1",
    });
    const updated = updateTicket(ticket, { description: "   " });

    expect(updated.description).toBeNull();
  });

  it("空タイトルは拒否される", () => {
    const ticket = baseTicket();
    expect(() => updateTicket(ticket, { title: "   " })).toThrow(
      TicketValidationError,
    );
  });

  it("201 文字以上のタイトルは拒否される", () => {
    const ticket = baseTicket();
    expect(() => updateTicket(ticket, { title: "a".repeat(201) })).toThrow(
      TicketValidationError,
    );
  });

  it("無効な priority は拒否される", () => {
    const ticket = baseTicket();
    expect(() =>
      updateTicket(ticket, { priority: "invalid" as TicketPriority }),
    ).toThrow(TicketValidationError);
  });

  it("ステータスを更新できる", () => {
    const ticket = baseTicket();
    const updated = updateTicketStatus(ticket, TicketStatus.Closed);

    expect(updated.status).toBe(TicketStatus.Closed);
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
      ticket.updatedAt.getTime(),
    );
  });

  it("無効なステータスは拒否される", () => {
    const ticket = baseTicket();
    expect(() => updateTicketStatus(ticket, "invalid" as TicketStatus)).toThrow(
      TicketValidationError,
    );
  });

  it.each([
    ["open から in-progress", TicketStatus.Open, TicketStatus.InProgress],
    ["open から closed", TicketStatus.Open, TicketStatus.Closed],
    ["in-progress から closed", TicketStatus.InProgress, TicketStatus.Closed],
  ])("有効な遷移: %s", (_label, fromStatus, toStatus) => {
    const ticket = createTicket({
      organizationId: "org-1",
      title: "transition",
      createdBy: "user-1",
    });
    const ticketWithStatus = { ...ticket, status: fromStatus };
    const updated = updateTicketStatus(ticketWithStatus, toStatus);
    expect(updated.status).toBe(toStatus);
  });

  it.each([
    ["closed から open", TicketStatus.Closed, TicketStatus.Open],
    ["closed から in-progress", TicketStatus.Closed, TicketStatus.InProgress],
    ["in-progress から open", TicketStatus.InProgress, TicketStatus.Open],
  ])("無効な遷移: %s", (_label, fromStatus, toStatus) => {
    const ticket = createTicket({
      organizationId: "org-1",
      title: "transition",
      createdBy: "user-1",
    });
    const ticketWithStatus = { ...ticket, status: fromStatus };
    expect(() => updateTicketStatus(ticketWithStatus, toStatus)).toThrow(
      TicketValidationError,
    );
  });

  it("同じステータスへの変更は許可される", () => {
    const ticket = baseTicket();
    const updated = updateTicketStatus(ticket, TicketStatus.Open);
    expect(updated.status).toBe(TicketStatus.Open);
  });

  it("優先度を更新できる", () => {
    const ticket = baseTicket();
    const updated = updateTicketPriority(ticket, TicketPriority.High);

    expect(updated.priority).toBe(TicketPriority.High);
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
      ticket.updatedAt.getTime(),
    );
  });

  it.each([
    ["low", TicketPriority.Low],
    ["medium", TicketPriority.Medium],
    ["high", TicketPriority.High],
    ["urgent", TicketPriority.Urgent],
  ])("優先度を %s に変更できる", (_label, priority) => {
    const ticket = baseTicket();
    const updated = updateTicketPriority(ticket, priority);

    expect(updated.priority).toBe(priority);
  });

  it("無効な優先度は拒否される", () => {
    const ticket = baseTicket();
    expect(() =>
      updateTicketPriority(ticket, "invalid" as TicketPriority),
    ).toThrow(TicketValidationError);
  });

  it("同じ優先度への変更は許可される", () => {
    const ticket = createTicket({
      organizationId: "org-1",
      title: "バグ",
      priority: TicketPriority.Medium,
      createdBy: "user-1",
    });
    const updated = updateTicketPriority(ticket, TicketPriority.Medium);

    expect(updated.priority).toBe(TicketPriority.Medium);
  });

  describe("updateTicketAssignee", () => {
    it("担当者を設定できる", () => {
      const ticket = baseTicket();
      const updated = updateTicketAssignee(ticket, "user-2");

      expect(updated.assigneeId).toBe("user-2");
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
        ticket.updatedAt.getTime(),
      );
    });

    it("担当者を null に設定して解除できる", () => {
      const ticket = createTicket({
        organizationId: "org-1",
        title: "バグ",
        assigneeId: "user-2",
        createdBy: "user-1",
      });
      const updated = updateTicketAssignee(ticket, null);

      expect(updated.assigneeId).toBeNull();
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
        ticket.updatedAt.getTime(),
      );
    });

    it("同じ担当者への変更は updatedAt を変更しない", () => {
      const ticket = createTicket({
        organizationId: "org-1",
        title: "バグ",
        assigneeId: "user-2",
        createdBy: "user-1",
      });
      const updated = updateTicketAssignee(ticket, "user-2");

      expect(updated.assigneeId).toBe("user-2");
      expect(updated.updatedAt.getTime()).toBe(ticket.updatedAt.getTime());
    });

    it("担当者IDの前後の空白は削除される", () => {
      const ticket = baseTicket();
      const updated = updateTicketAssignee(ticket, "  user-2  ");

      expect(updated.assigneeId).toBe("user-2");
    });

    it("空文字の担当者IDは拒否される", () => {
      const ticket = baseTicket();
      expect(() => updateTicketAssignee(ticket, "   ")).toThrow(
        TicketValidationError,
      );
    });
  });
});

describe("parseTicketStatus", () => {
  it.each([
    ["open", TicketStatus.Open],
    ["in-progress", TicketStatus.InProgress],
    ["closed", TicketStatus.Closed],
  ])("%s を TicketStatus に変換できる", (value, expected) => {
    expect(parseTicketStatus(value)).toBe(expected);
  });

  it.each([["invalid"], [""], ["OPEN"], ["medium"], [" open "]])(
    "無効な値 %s は TicketInvalidStateError を投げる",
    (value) => {
      expect(() => parseTicketStatus(value)).toThrow(TicketInvalidStateError);
    },
  );
});

describe("parseTicketPriority", () => {
  it.each([
    ["low", TicketPriority.Low],
    ["medium", TicketPriority.Medium],
    ["high", TicketPriority.High],
    ["urgent", TicketPriority.Urgent],
  ])("%s を TicketPriority に変換できる", (value, expected) => {
    expect(parseTicketPriority(value)).toBe(expected);
  });

  it.each([["invalid"], [""], ["HIGH"], ["open"], [" low "]])(
    "無効な値 %s は TicketInvalidStateError を投げる",
    (value) => {
      expect(() => parseTicketPriority(value)).toThrow(TicketInvalidStateError);
    },
  );
});

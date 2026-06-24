import { describe, expect, it } from "vitest";

import {
  CommentValidationError,
  createComment,
  rehydrateComment,
} from "../../../src/domain/comment.js";

describe("コメント作成", () => {
  it("有効な入力でコメントが作成できる", () => {
    const comment = createComment({
      ticketId: "ticket-1",
      organizationId: "org-1",
      authorId: "user-1",
      content: "対応しました",
    });

    expect(comment).toEqual({
      id: expect.any(String),
      ticketId: "ticket-1",
      organizationId: "org-1",
      authorId: "user-1",
      content: "対応しました",
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
    expect(comment.createdAt.getTime()).toBe(comment.updatedAt.getTime());
  });

  it("content の前後の空白は削除される", () => {
    const comment = createComment({
      ticketId: "ticket-1",
      organizationId: "org-1",
      authorId: "user-1",
      content: "  対応しました  ",
    });

    expect(comment.content).toBe("対応しました");
  });

  it("ticketId の前後の空白は削除される", () => {
    const comment = createComment({
      ticketId: "  ticket-1  ",
      organizationId: "org-1",
      authorId: "user-1",
      content: "対応しました",
    });

    expect(comment.ticketId).toBe("ticket-1");
  });

  it("organizationId の前後の空白は削除される", () => {
    const comment = createComment({
      ticketId: "ticket-1",
      organizationId: "  org-1  ",
      authorId: "user-1",
      content: "対応しました",
    });

    expect(comment.organizationId).toBe("org-1");
  });

  it("authorId の前後の空白は削除される", () => {
    const comment = createComment({
      ticketId: "ticket-1",
      organizationId: "org-1",
      authorId: "  user-1  ",
      content: "対応しました",
    });

    expect(comment.authorId).toBe("user-1");
  });

  it.each([
    ["空文字", ""],
    ["空白のみ", "   "],
    ["タブと改行のみ", "\t\n"],
    ["全角スペースのみ", "　"],
  ])("%s の content は拒否される", (_label, content) => {
    expect(() =>
      createComment({
        ticketId: "ticket-1",
        organizationId: "org-1",
        authorId: "user-1",
        content,
      }),
    ).toThrow(CommentValidationError);
  });

  it.each([
    ["空文字", ""],
    ["空白のみ", "   "],
    ["タブと改行のみ", "\t\n"],
    ["全角スペースのみ", "　"],
  ])("%s の ticketId は拒否される", (_label, ticketId) => {
    expect(() =>
      createComment({
        ticketId,
        organizationId: "org-1",
        authorId: "user-1",
        content: "対応しました",
      }),
    ).toThrow(CommentValidationError);
  });

  it.each([
    ["空文字", ""],
    ["空白のみ", "   "],
    ["タブと改行のみ", "\t\n"],
    ["全角スペースのみ", "　"],
  ])("%s の organizationId は拒否される", (_label, organizationId) => {
    expect(() =>
      createComment({
        ticketId: "ticket-1",
        organizationId,
        authorId: "user-1",
        content: "対応しました",
      }),
    ).toThrow(CommentValidationError);
  });

  it.each([
    ["空文字", ""],
    ["空白のみ", "   "],
    ["タブと改行のみ", "\t\n"],
    ["全角スペースのみ", "　"],
  ])("%s の authorId は拒否される", (_label, authorId) => {
    expect(() =>
      createComment({
        ticketId: "ticket-1",
        organizationId: "org-1",
        authorId,
        content: "対応しました",
      }),
    ).toThrow(CommentValidationError);
  });

  it("10000 文字以内の content は許容される", () => {
    expect(() =>
      createComment({
        ticketId: "ticket-1",
        organizationId: "org-1",
        authorId: "user-1",
        content: "a".repeat(10000),
      }),
    ).not.toThrow();
  });

  it("10001 文字の content は拒否される", () => {
    expect(() =>
      createComment({
        ticketId: "ticket-1",
        organizationId: "org-1",
        authorId: "user-1",
        content: "a".repeat(10001),
      }),
    ).toThrow(CommentValidationError);
  });

  it("前後の空白を除いた長さで content の上限を判定する", () => {
    const content = `  ${"a".repeat(10001)}  `;

    expect(() =>
      createComment({
        ticketId: "ticket-1",
        organizationId: "org-1",
        authorId: "user-1",
        content,
      }),
    ).toThrow(CommentValidationError);
  });
});

describe("コメント復元", () => {
  it("有効な値でコメントを復元できる", () => {
    const input = {
      id: "comment-1",
      ticketId: "ticket-1",
      organizationId: "org-1",
      authorId: "user-1",
      content: "対応しました",
      createdAt: new Date("2026-06-19T00:00:00.000Z"),
      updatedAt: new Date("2026-06-19T01:00:00.000Z"),
    };

    const comment = rehydrateComment(input);

    expect(comment).toEqual(input);
  });

  it("復元時に ID 系フィールドと content の前後の空白を削除する", () => {
    const comment = rehydrateComment({
      id: "comment-1",
      ticketId: "  ticket-1  ",
      organizationId: "  org-1  ",
      authorId: "  user-1  ",
      content: "  対応しました  ",
      createdAt: new Date("2026-06-19T00:00:00.000Z"),
      updatedAt: new Date("2026-06-19T01:00:00.000Z"),
    });

    expect(comment.ticketId).toBe("ticket-1");
    expect(comment.organizationId).toBe("org-1");
    expect(comment.authorId).toBe("user-1");
    expect(comment.content).toBe("対応しました");
  });

  it.each([
    ["空文字の content", { content: "" }],
    ["10001文字の content", { content: "a".repeat(10001) }],
    ["空文字の ticketId", { ticketId: "" }],
    ["空文字の organizationId", { organizationId: "" }],
    ["空文字の authorId", { authorId: "" }],
  ])("%s は拒否される", (_label, override) => {
    expect(() =>
      rehydrateComment({
        id: "comment-1",
        ticketId: "ticket-1",
        organizationId: "org-1",
        authorId: "user-1",
        content: "対応しました",
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
        updatedAt: new Date("2026-06-19T01:00:00.000Z"),
        ...override,
      }),
    ).toThrow(CommentValidationError);
  });

  it("文字列ではない createdAt は拒否される", () => {
    expect(() =>
      rehydrateComment({
        id: "comment-1",
        ticketId: "ticket-1",
        organizationId: "org-1",
        authorId: "user-1",
        content: "対応しました",
        createdAt: "invalid" as unknown as Date,
        updatedAt: new Date("2026-06-19T01:00:00.000Z"),
      }),
    ).toThrow(CommentValidationError);
  });
});

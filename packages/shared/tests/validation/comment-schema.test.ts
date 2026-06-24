import { z } from "zod";

import {
  commentAuthorIdSchema,
  commentContentSchema,
  commentOrganizationIdSchema,
  commentTicketIdSchema,
  createCommentInputSchema,
} from "../../src/validation/comment-schema.js";

const MAX_ID_LENGTH = 200;

describe("commentContentSchema", () => {
  it("有効なコメントを受け入れる", () => {
    const result = commentContentSchema.safeParse("対応しました");
    expect(result.success).toBe(true);
  });

  it("空文字を拒否する", () => {
    const result = commentContentSchema.safeParse("");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("コメントを入力してください");
    }
  });

  it("空白のみを拒否する", () => {
    const result = commentContentSchema.safeParse("   ");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("コメントを入力してください");
    }
  });

  it("10000文字を超えるコメントを拒否する", () => {
    const result = commentContentSchema.safeParse("a".repeat(10001));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "コメントは10000文字以内で入力してください",
      );
    }
  });

  it("10000文字ちょうどのコメントを受け入れる", () => {
    const result = commentContentSchema.safeParse("a".repeat(10000));
    expect(result.success).toBe(true);
  });

  it("trim 後の長さで上限を判定する", () => {
    const result = commentContentSchema.safeParse(
      " ".repeat(5000) + "a".repeat(10001) + " ".repeat(5000),
    );
    expect(result.success).toBe(false);
  });
});

function assertIdRejectsEmptyAndWhitespace(schema: z.ZodType<string>) {
  it("空文字を拒否する", () => {
    const result = schema.safeParse("");
    expect(result.success).toBe(false);
  });

  it("空白のみを拒否する", () => {
    const result = schema.safeParse("   ");
    expect(result.success).toBe(false);
  });

  it("タブと改行のみを拒否する", () => {
    const result = schema.safeParse("\t\n");
    expect(result.success).toBe(false);
  });

  it("全角スペースのみを拒否する", () => {
    const result = schema.safeParse("　");
    expect(result.success).toBe(false);
  });

  it("200文字を超えるIDを拒否する", () => {
    const result = schema.safeParse("a".repeat(201));
    expect(result.success).toBe(false);
  });

  it("200文字ちょうどのIDを受け入れる", () => {
    const result = schema.safeParse("a".repeat(MAX_ID_LENGTH));
    expect(result.success).toBe(true);
  });
}

describe("commentTicketIdSchema", () => {
  it("有効なチケットIDを受け入れる", () => {
    const result = commentTicketIdSchema.safeParse("ticket-1");
    expect(result.success).toBe(true);
  });

  assertIdRejectsEmptyAndWhitespace(commentTicketIdSchema);
});

describe("commentOrganizationIdSchema", () => {
  it("有効な組織IDを受け入れる", () => {
    const result = commentOrganizationIdSchema.safeParse("org-1");
    expect(result.success).toBe(true);
  });

  assertIdRejectsEmptyAndWhitespace(commentOrganizationIdSchema);
});

describe("commentAuthorIdSchema", () => {
  it("有効な作成者IDを受け入れる", () => {
    const result = commentAuthorIdSchema.safeParse("user-1");
    expect(result.success).toBe(true);
  });

  assertIdRejectsEmptyAndWhitespace(commentAuthorIdSchema);
});

describe("createCommentInputSchema", () => {
  it("有効な入力を受け入れる", () => {
    const result = createCommentInputSchema.safeParse({
      ticketId: "ticket-1",
      organizationId: "org-1",
      authorId: "user-1",
      content: "対応しました",
    });
    expect(result.success).toBe(true);
  });

  it("content の前後の空白を削除する", () => {
    const result = createCommentInputSchema.safeParse({
      ticketId: "ticket-1",
      organizationId: "org-1",
      authorId: "user-1",
      content: "  対応しました  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.content).toBe("対応しました");
    }
  });

  it("必須フィールドが欠けていると拒否する", () => {
    const result = createCommentInputSchema.safeParse({
      ticketId: "ticket-1",
    });
    expect(result.success).toBe(false);
  });
});

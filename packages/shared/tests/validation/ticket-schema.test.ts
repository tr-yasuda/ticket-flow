import {
  createTicketInputSchema,
  ticketStatusSchema,
  ticketTitleSchema,
  updateTicketStatusInputSchema,
} from "../../src/validation/ticket-schema.js";

describe("ticketTitleSchema", () => {
  it("有効なタイトルを受け入れる", () => {
    const result = ticketTitleSchema.safeParse("チケットのタイトル");
    expect(result.success).toBe(true);
  });

  it("空文字を拒否する", () => {
    const result = ticketTitleSchema.safeParse("");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("タイトルを入力してください");
    }
  });

  it("空白のみを拒否する", () => {
    const result = ticketTitleSchema.safeParse("   ");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("タイトルを入力してください");
    }
  });

  it("200文字を超えるタイトルを拒否する", () => {
    const result = ticketTitleSchema.safeParse("a".repeat(201));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "タイトルは200文字以内で入力してください",
      );
    }
  });

  it("200文字ちょうどのタイトルを受け入れる", () => {
    const result = ticketTitleSchema.safeParse("a".repeat(200));
    expect(result.success).toBe(true);
  });
});

describe("ticketStatusSchema", () => {
  it.each(["open", "in-progress", "closed"] as const)(
    "有効なステータス %s を受け入れる",
    (status) => {
      const result = ticketStatusSchema.safeParse(status);
      expect(result.success).toBe(true);
    },
  );

  it("無効なステータスを拒否する", () => {
    const result = ticketStatusSchema.safeParse("invalid");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "ステータスの値が正しくありません",
      );
    }
  });
});

describe("createTicketInputSchema", () => {
  it("有効な入力を受け入れる", () => {
    const result = createTicketInputSchema.safeParse({
      title: "新規チケット",
    });
    expect(result.success).toBe(true);
  });

  it("タイトルがない場合は拒否する", () => {
    const result = createTicketInputSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path[0]).toBe("title");
    }
  });
});

describe("updateTicketStatusInputSchema", () => {
  it("有効な入力を受け入れる", () => {
    const result = updateTicketStatusInputSchema.safeParse({
      status: "closed",
    });
    expect(result.success).toBe(true);
  });

  it("ステータスがない場合は拒否する", () => {
    const result = updateTicketStatusInputSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path[0]).toBe("status");
    }
  });
});

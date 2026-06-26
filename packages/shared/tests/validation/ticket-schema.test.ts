import {
  createTicketInputSchema,
  ticketDescriptionSchema,
  ticketPrioritySchema,
  ticketStatusSchema,
  ticketTitleSchema,
  updateTicketPriorityInputSchema,
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

describe("ticketDescriptionSchema", () => {
  it("有効な説明文を受け入れる", () => {
    const result = ticketDescriptionSchema.safeParse("説明文");
    expect(result.success).toBe(true);
  });

  it("空白のみの説明文を null として受け入れる", () => {
    const result = ticketDescriptionSchema.safeParse("   ");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeNull();
    }
  });

  it("10000文字を超える説明文を拒否する", () => {
    const result = ticketDescriptionSchema.safeParse("a".repeat(10001));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "説明は10000文字以内で入力してください",
      );
    }
  });

  it("10000文字ちょうどの説明文を受け入れる", () => {
    const result = ticketDescriptionSchema.safeParse("a".repeat(10000));
    expect(result.success).toBe(true);
  });

  it("trim 後の長さで上限を判定する", () => {
    const result = ticketDescriptionSchema.safeParse(
      " ".repeat(5000) + "a".repeat(10001) + " ".repeat(5000),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "説明は10000文字以内で入力してください",
      );
    }
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

describe("ticketPrioritySchema", () => {
  it.each(["low", "medium", "high", "urgent"] as const)(
    "有効な優先度 %s を受け入れる",
    (priority) => {
      const result = ticketPrioritySchema.safeParse(priority);
      expect(result.success).toBe(true);
    },
  );

  it("無効な優先度を拒否する", () => {
    const result = ticketPrioritySchema.safeParse("invalid");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "優先度の値が正しくありません",
      );
    }
  });
});

describe("createTicketInputSchema", () => {
  it("有効な入力を受け入れる", () => {
    const result = createTicketInputSchema.safeParse({
      title: "新規チケット",
      organizationId: "org-1",
      createdBy: "user-1",
    });
    expect(result.success).toBe(true);
  });

  it("オプション項目を受け入れる", () => {
    const result = createTicketInputSchema.safeParse({
      title: "新規チケット",
      organizationId: "org-1",
      createdBy: "user-1",
      description: "説明文",
      priority: "high",
      assigneeId: "user-2",
    });
    expect(result.success).toBe(true);
  });

  it("タイトルがない場合は拒否する", () => {
    const result = createTicketInputSchema.safeParse({
      organizationId: "org-1",
      createdBy: "user-1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path[0]).toBe("title");
    }
  });

  it("組織IDがない場合は拒否する", () => {
    const result = createTicketInputSchema.safeParse({
      title: "新規チケット",
      createdBy: "user-1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path[0]).toBe("organizationId");
    }
  });

  it("作成者IDがない場合は拒否する", () => {
    const result = createTicketInputSchema.safeParse({
      title: "新規チケット",
      organizationId: "org-1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path[0]).toBe("createdBy");
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

describe("updateTicketPriorityInputSchema", () => {
  it.each(["low", "medium", "high", "urgent"] as const)(
    "有効な優先度 %s を受け入れる",
    (priority) => {
      const result = updateTicketPriorityInputSchema.safeParse({ priority });
      expect(result.success).toBe(true);
    },
  );

  it("優先度がない場合は拒否する", () => {
    const result = updateTicketPriorityInputSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path[0]).toBe("priority");
    }
  });

  it("無効な優先度を拒否する", () => {
    const result = updateTicketPriorityInputSchema.safeParse({
      priority: "invalid",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "優先度の値が正しくありません",
      );
    }
  });
});

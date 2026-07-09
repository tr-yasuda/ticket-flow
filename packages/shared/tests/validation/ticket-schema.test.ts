import {
  createTicketInputSchema,
  ticketDescriptionSchema,
  ticketDetailResponseSchema,
  ticketDetailSchema,
  ticketListItemResponseSchema,
  ticketPrioritySchema,
  ticketStatusSchema,
  ticketTitleSchema,
  updateTicketAssigneeInputSchema,
  updateTicketInputSchema,
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

describe("updateTicketAssigneeInputSchema", () => {
  it("有効な担当者IDを受け入れる", () => {
    const result = updateTicketAssigneeInputSchema.safeParse({
      assigneeId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("null で担当者を解除できる", () => {
    const result = updateTicketAssigneeInputSchema.safeParse({
      assigneeId: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.assigneeId).toBeNull();
    }
  });

  it("assigneeId がない場合は拒否する", () => {
    const result = updateTicketAssigneeInputSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path[0]).toBe("assigneeId");
    }
  });

  it("空文字の担当者IDを拒否する", () => {
    const result = updateTicketAssigneeInputSchema.safeParse({
      assigneeId: "   ",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path[0]).toBe("assigneeId");
    }
  });

  it("無効なUUIDの担当者IDを拒否する", () => {
    const result = updateTicketAssigneeInputSchema.safeParse({
      assigneeId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path[0]).toBe("assigneeId");
    }
  });
});

describe("updateTicketInputSchema", () => {
  it("title のみの更新を受け入れる", () => {
    const result = updateTicketInputSchema.safeParse({
      title: "新しいタイトル",
    });
    expect(result.success).toBe(true);
  });

  it("description のみの更新を受け入れる", () => {
    const result = updateTicketInputSchema.safeParse({ description: "説明" });
    expect(result.success).toBe(true);
  });

  it("priority のみの更新を受け入れる", () => {
    const result = updateTicketInputSchema.safeParse({ priority: "high" });
    expect(result.success).toBe(true);
  });

  it("空のパッチを拒否する", () => {
    const result = updateTicketInputSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "更新する項目を指定してください",
      );
    }
  });
});

describe("ticketListItemResponseSchema", () => {
  const validListItem = {
    id: "ticket-1",
    organizationId: "org-1",
    title: "チケットタイトル",
    status: "open",
    priority: "medium",
    assignee: { id: "user-1", name: null },
    createdBy: "user-2",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    commentCount: 0,
  };

  it("有効な一覧アイテムを受け入れて Date に変換する", () => {
    const result = ticketListItemResponseSchema.safeParse(validListItem);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.createdAt).toBeInstanceOf(Date);
      expect(result.data.updatedAt).toBeInstanceOf(Date);
    }
  });

  it("空文字の ID を拒否する", () => {
    const result = ticketListItemResponseSchema.safeParse({
      ...validListItem,
      id: "",
    });
    expect(result.success).toBe(false);
  });

  it("Date オブジェクトを拒否する", () => {
    const result = ticketListItemResponseSchema.safeParse({
      ...validListItem,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    expect(result.success).toBe(false);
  });
});

describe("ticketDetailSchema", () => {
  const validDetail = {
    id: "ticket-1",
    organizationId: "org-1",
    title: "チケットタイトル",
    description: null,
    status: "open",
    priority: "medium",
    createdBy: "user-2",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    commentCount: 0,
    assigneeId: "user-1",
  };

  it("有効な詳細レスポンスを受け入れて Date に変換する", () => {
    const result = ticketDetailSchema.safeParse(validDetail);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.assigneeId).toBe("user-1");
      expect(result.data.createdAt).toBeInstanceOf(Date);
      expect(result.data.updatedAt).toBeInstanceOf(Date);
    }
  });

  it("assigneeId: null を受け入れる", () => {
    const result = ticketDetailSchema.safeParse({
      ...validDetail,
      assigneeId: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.assigneeId).toBeNull();
    }
  });

  it("assigneeId が欠けている詳細レスポンスを拒否する", () => {
    const { assigneeId: _, ...withoutAssigneeId } = validDetail;
    const result = ticketDetailResponseSchema.safeParse(withoutAssigneeId);
    expect(result.success).toBe(false);
  });

  it("空文字の assigneeId を拒否する", () => {
    const result = ticketDetailSchema.safeParse({
      ...validDetail,
      assigneeId: "",
    });
    expect(result.success).toBe(false);
  });
});

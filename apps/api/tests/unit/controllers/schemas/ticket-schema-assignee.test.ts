import { describe, expect, it } from "vitest";

import { listTicketsQuerySchema } from "../../../../src/controllers/schemas/ticket-schema.js";

describe("listTicketsQuerySchema の assignee パース", () => {
  it("assignee が省略された場合は undefined を返す", () => {
    const result = listTicketsQuerySchema.parse({});
    expect(result.assignee).toBeUndefined();
  });

  it("assignee=none は null に変換する", () => {
    const result = listTicketsQuerySchema.parse({ assignee: "none" });
    expect(result.assignee).toBeNull();
  });

  it("assignee=NONE も null に変換する", () => {
    const result = listTicketsQuerySchema.parse({ assignee: "NONE" });
    expect(result.assignee).toBeNull();
  });

  it("assignee の前後空白をトリムする", () => {
    const result = listTicketsQuerySchema.parse({ assignee: "  none  " });
    expect(result.assignee).toBeNull();
  });

  it("有効な UUID は小文字化して返す", () => {
    const result = listTicketsQuerySchema.parse({
      assignee: "550E8400-E29B-41D4-A716-446655440000",
    });
    expect(result.assignee).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("UUID の前後空白をトリムする", () => {
    const result = listTicketsQuerySchema.parse({
      assignee: "  550e8400-e29b-41d4-a716-446655440000  ",
    });
    expect(result.assignee).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("無効な assignee はバリデーションエラーになる", () => {
    expect(() => listTicketsQuerySchema.parse({ assignee: "invalid" })).toThrow(
      /担当者IDの形式が正しくありません/,
    );
  });

  it("空文字の assignee はバリデーションエラーになる", () => {
    expect(() => listTicketsQuerySchema.parse({ assignee: "" })).toThrow();
  });
});

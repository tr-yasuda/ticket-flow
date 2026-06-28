import { describe, expect, it } from "vitest";

import { listTicketsQuerySchema } from "../../../../src/controllers/schemas/ticket-schema.js";

describe("listTicketsQuerySchema の priority パース", () => {
  it("単一の優先度を配列に変換する", () => {
    const result = listTicketsQuerySchema.parse({
      priority: "high",
    });
    expect(result.priority).toEqual(["high"]);
  });

  it("カンマ区切りの複数優先度を配列に変換する", () => {
    const result = listTicketsQuerySchema.parse({
      priority: "high,urgent",
    });
    expect(result.priority).toEqual(["high", "urgent"]);
  });

  it("無効な優先度値は無視される", () => {
    const result = listTicketsQuerySchema.parse({
      priority: "high,invalid",
    });
    expect(result.priority).toEqual(["high"]);
  });

  it("すべて無効な優先度値の場合は undefined を返す", () => {
    const result = listTicketsQuerySchema.parse({
      priority: "invalid1,invalid2",
    });
    expect(result.priority).toBeUndefined();
  });

  it("priority が省略された場合は undefined を返す", () => {
    const result = listTicketsQuerySchema.parse({});
    expect(result.priority).toBeUndefined();
  });

  it("配列形式の優先度を受け付ける", () => {
    const result = listTicketsQuerySchema.parse({
      priority: ["high", "low"],
    });
    expect(result.priority).toEqual(["high", "low"]);
  });

  it("配列形式でも無効な値は無視される", () => {
    const result = listTicketsQuerySchema.parse({
      priority: ["high", "invalid"],
    });
    expect(result.priority).toEqual(["high"]);
  });

  it("空配列の priority は undefined を返す", () => {
    const result = listTicketsQuerySchema.parse({
      priority: [],
    });
    expect(result.priority).toBeUndefined();
  });

  it("前後の空白をトリムする", () => {
    const result = listTicketsQuerySchema.parse({
      priority: " high , urgent ",
    });
    expect(result.priority).toEqual(["high", "urgent"]);
  });

  it("空文字や空白のみの値は無視される", () => {
    const result = listTicketsQuerySchema.parse({
      priority: "high, , ,low",
    });
    expect(result.priority).toEqual(["high", "low"]);
  });

  it("空文字の priority は undefined を返す", () => {
    const result = listTicketsQuerySchema.parse({
      priority: "",
    });
    expect(result.priority).toBeUndefined();
  });

  it("空白のみの priority は undefined を返す", () => {
    const result = listTicketsQuerySchema.parse({
      priority: "   ",
    });
    expect(result.priority).toBeUndefined();
  });

  it("大文字の優先度値は無視される", () => {
    const result = listTicketsQuerySchema.parse({
      priority: "High,Urgent",
    });
    expect(result.priority).toBeUndefined();
  });
});

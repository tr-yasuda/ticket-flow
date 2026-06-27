import { describe, expect, it } from "vitest";

import { listTicketsQuerySchema } from "../../../../src/controllers/schemas/ticket-schema.js";

describe("listTicketsQuerySchema の status パース", () => {
  it("単一のステータスを配列に変換する", () => {
    const result = listTicketsQuerySchema.parse({
      status: "open",
    });
    expect(result.status).toEqual(["open"]);
  });

  it("カンマ区切りの複数ステータスを配列に変換する", () => {
    const result = listTicketsQuerySchema.parse({
      status: "open,in-progress",
    });
    expect(result.status).toEqual(["open", "in-progress"]);
  });

  it("無効なステータス値は無視される", () => {
    const result = listTicketsQuerySchema.parse({
      status: "open,invalid",
    });
    expect(result.status).toEqual(["open"]);
  });

  it("すべて無効なステータス値の場合は undefined を返す", () => {
    const result = listTicketsQuerySchema.parse({
      status: "invalid1,invalid2",
    });
    expect(result.status).toBeUndefined();
  });

  it("status が省略された場合は undefined を返す", () => {
    const result = listTicketsQuerySchema.parse({});
    expect(result.status).toBeUndefined();
  });

  it("配列形式のステータスを受け付ける", () => {
    const result = listTicketsQuerySchema.parse({
      status: ["open", "closed"],
    });
    expect(result.status).toEqual(["open", "closed"]);
  });

  it("配列形式でも無効な値は無視される", () => {
    const result = listTicketsQuerySchema.parse({
      status: ["open", "invalid"],
    });
    expect(result.status).toEqual(["open"]);
  });

  it("前後の空白をトリムする", () => {
    const result = listTicketsQuerySchema.parse({
      status: " open , in-progress ",
    });
    expect(result.status).toEqual(["open", "in-progress"]);
  });

  it("空文字や空白のみの値は無視される", () => {
    const result = listTicketsQuerySchema.parse({
      status: "open, , ,closed",
    });
    expect(result.status).toEqual(["open", "closed"]);
  });

  it("空文字の status は undefined を返す", () => {
    const result = listTicketsQuerySchema.parse({
      status: "",
    });
    expect(result.status).toBeUndefined();
  });

  it("空白のみの status は undefined を返す", () => {
    const result = listTicketsQuerySchema.parse({
      status: "   ",
    });
    expect(result.status).toBeUndefined();
  });

  it("大文字のステータス値は無視される", () => {
    const result = listTicketsQuerySchema.parse({
      status: "Open,In-Progress",
    });
    expect(result.status).toBeUndefined();
  });
});

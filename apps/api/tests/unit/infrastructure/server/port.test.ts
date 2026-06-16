import { describe, expect, it } from "vitest";

import { parsePort } from "../../../../src/infrastructure/server/port";

describe("parsePort", () => {
  it("undefined の場合は 3000 を返す", () => {
    expect(parsePort(undefined)).toBe(3000);
  });

  it("空文字の場合は 3000 を返す", () => {
    expect(parsePort("")).toBe(3000);
  });

  it("空白のみの場合は 3000 を返す", () => {
    expect(parsePort("   ")).toBe(3000);
  });

  it("有効なポート番号を返す", () => {
    expect(parsePort("8080")).toBe(8080);
  });

  it("無効な値はエラー", () => {
    expect(() => parsePort("abc")).toThrow("Invalid PORT: abc");
  });

  it("範囲外の値はエラー", () => {
    expect(() => parsePort("70000")).toThrow("Invalid PORT: 70000");
  });
});

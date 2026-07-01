import { describe, expect, it } from "vitest";

import {
  extractData,
  isApiPaginatedEnvelope,
  isApiSuccessEnvelope,
  isRecord,
} from "@/lib/api-response";

describe("api-response", () => {
  describe("isRecord", () => {
    it("object は record として判定する", () => {
      expect(isRecord({})).toBe(true);
    });

    it("配列は record として判定しない", () => {
      expect(isRecord([])).toBe(false);
    });

    it("null は record として判定しない", () => {
      expect(isRecord(null)).toBe(false);
    });

    it("undefined は record として判定しない", () => {
      expect(isRecord(undefined)).toBe(false);
    });

    it("string は record として判定しない", () => {
      expect(isRecord("value")).toBe(false);
    });

    it("number は record として判定しない", () => {
      expect(isRecord(1)).toBe(false);
    });
  });

  describe("isApiSuccessEnvelope", () => {
    it("success: true と data を持つレスポンスを判定する", () => {
      expect(isApiSuccessEnvelope({ success: true, data: {} })).toBe(true);
    });

    it("data が配列でも判定する", () => {
      expect(isApiSuccessEnvelope({ success: true, data: [] })).toBe(true);
    });

    it("data が null でも判定する", () => {
      expect(isApiSuccessEnvelope({ success: true, data: null })).toBe(true);
    });

    it("data が undefined でも判定する", () => {
      expect(isApiSuccessEnvelope({ success: true, data: undefined })).toBe(
        true,
      );
    });

    it("data がスカラーでも判定する", () => {
      expect(isApiSuccessEnvelope({ success: true, data: "value" })).toBe(true);
    });

    it("data がないレスポンスは判定しない", () => {
      expect(isApiSuccessEnvelope({ success: true })).toBe(false);
    });

    it("success: false のレスポンスは判定しない", () => {
      expect(isApiSuccessEnvelope({ success: false, data: {} })).toBe(false);
    });

    it("空オブジェクトは判定しない", () => {
      expect(isApiSuccessEnvelope({})).toBe(false);
    });

    it("null は判定しない", () => {
      expect(isApiSuccessEnvelope(null)).toBe(false);
    });

    it("配列は判定しない", () => {
      expect(isApiSuccessEnvelope([{ success: true, data: {} }])).toBe(false);
    });
  });

  describe("isApiPaginatedEnvelope", () => {
    it("success: true と data と record の meta を持つレスポンスを判定する", () => {
      expect(
        isApiPaginatedEnvelope({ success: true, data: {}, meta: {} }),
      ).toBe(true);
    });

    it("meta が配列のレスポンスは判定しない", () => {
      expect(
        isApiPaginatedEnvelope({ success: true, data: {}, meta: [] }),
      ).toBe(false);
    });

    it("meta がないレスポンスは判定しない", () => {
      expect(isApiPaginatedEnvelope({ success: true, data: {} })).toBe(false);
    });

    it("meta が null のレスポンスは判定しない", () => {
      expect(
        isApiPaginatedEnvelope({ success: true, data: {}, meta: null }),
      ).toBe(false);
    });

    it("success: false のレスポンスは判定しない", () => {
      expect(
        isApiPaginatedEnvelope({
          success: false,
          data: {},
          meta: {},
        }),
      ).toBe(false);
    });
  });

  describe("extractData", () => {
    it("success response から data を取り出す", () => {
      const data = extractData(
        { success: true, data: { value: 1 } },
        (item): item is { value: number } =>
          isRecord(item) && typeof item.value === "number",
      );

      expect(data).toEqual({ value: 1 });
    });

    it("data が検証を満たさない場合は invalid data エラー", () => {
      expect(() =>
        extractData(
          { success: true, data: { value: "not-number" } },
          (item): item is { value: number } =>
            isRecord(item) && typeof item.value === "number",
        ),
      ).toThrow("Invalid response: invalid data");
    });

    it("success response でない場合は invalid envelope エラー", () => {
      expect(() =>
        extractData(
          { value: 1 },
          (item): item is { value: number } =>
            isRecord(item) && typeof item.value === "number",
        ),
      ).toThrow("Invalid response: invalid envelope");
    });

    it("ラップなしレスポンスは invalid envelope エラー", () => {
      expect(() =>
        extractData(
          { value: 1 },
          (item): item is { value: number } =>
            isRecord(item) && typeof item.value === "number",
        ),
      ).toThrow("Invalid response: invalid envelope");
    });

    it("カスタムメッセージを envelope エラーに指定できる", () => {
      expect(() =>
        extractData(
          { success: false },
          (item): item is { value: number } =>
            isRecord(item) && typeof item.value === "number",
          "Custom error message",
        ),
      ).toThrow("Custom error message: invalid envelope");
    });

    it("カスタムメッセージを data エラーに指定できる", () => {
      expect(() =>
        extractData(
          { success: true, data: { value: "not-number" } },
          (item): item is { value: number } =>
            isRecord(item) && typeof item.value === "number",
          "Custom error message",
        ),
      ).toThrow("Custom error message: invalid data");
    });
  });
});

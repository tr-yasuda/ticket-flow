import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ApiResponseValidationError, extractData } from "@/lib/api-response";

const valueSchema = z.object({ value: z.number() });

describe("api-response", () => {
  describe("extractData", () => {
    it("success response から data を取り出す", () => {
      const data = extractData(
        { success: true, data: { value: 1 } },
        valueSchema,
      );

      expect(data).toEqual({ value: 1 });
    });

    it("data が検証を満たさない場合は invalid data エラー", () => {
      expect(() =>
        extractData(
          { success: true, data: { value: "not-number" } },
          valueSchema,
        ),
      ).toThrow("Invalid response: invalid data");
    });

    it("success response でない場合は invalid envelope エラー", () => {
      expect(() => extractData({ value: 1 }, valueSchema)).toThrow(
        "Invalid response: invalid envelope",
      );
    });

    it("ラップなしレスポンスは invalid envelope エラー", () => {
      expect(() => extractData({ value: 1 }, valueSchema)).toThrow(
        "Invalid response: invalid envelope",
      );
    });

    it("カスタムメッセージを envelope エラーに指定できる", () => {
      expect(() =>
        extractData({ success: false }, valueSchema, "Custom error message"),
      ).toThrow("Custom error message: invalid envelope");
    });

    it("カスタムメッセージを data エラーに指定できる", () => {
      expect(() =>
        extractData(
          { success: true, data: { value: "not-number" } },
          valueSchema,
          "Custom error message",
        ),
      ).toThrow("Custom error message: invalid data");
    });

    it("検証失敗時に ZodError を cause として保持する", () => {
      let caught: unknown;
      try {
        extractData(
          { success: true, data: { value: "not-number" } },
          valueSchema,
        );
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(ApiResponseValidationError);
      expect((caught as ApiResponseValidationError).cause).toBeInstanceOf(
        z.ZodError,
      );
    });
  });
});

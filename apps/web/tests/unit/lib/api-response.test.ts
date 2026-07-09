import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  ApiResponseValidationError,
  extractData,
  extractPaginatedResponse,
} from "@/lib/api-response";

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

    it("data 検証失敗時に ZodError を cause として保持する", () => {
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

    it("envelope 検証失敗時に ZodError を cause として保持する", () => {
      let caught: unknown;
      try {
        extractData({ value: 1 }, valueSchema);
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(ApiResponseValidationError);
      expect((caught as ApiResponseValidationError).cause).toBeInstanceOf(
        z.ZodError,
      );
    });
  });

  describe("extractPaginatedResponse", () => {
    it("ページネーション付き success response から data と meta を取り出す", () => {
      const { data, meta } = extractPaginatedResponse(
        {
          success: true,
          data: { values: [{ value: 1 }] },
          meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
        },
        z.object({ values: z.array(valueSchema) }),
      );

      expect(data).toEqual({ values: [{ value: 1 }] });
      expect(meta).toEqual({ page: 1, perPage: 20, total: 1, totalPages: 1 });
    });

    it("不正な meta を含むレスポンスは invalid envelope エラー", () => {
      expect(() =>
        extractPaginatedResponse(
          {
            success: true,
            data: { values: [] },
            meta: { page: 1, perPage: 200, total: 0, totalPages: 0 },
          },
          z.object({ values: z.array(valueSchema) }),
        ),
      ).toThrow("Invalid response: invalid envelope");
    });

    it("total と totalPages が一致しない meta はエラー", () => {
      expect(() =>
        extractPaginatedResponse(
          {
            success: true,
            data: { values: [] },
            meta: { page: 1, perPage: 20, total: 40, totalPages: 1 },
          },
          z.object({ values: z.array(valueSchema) }),
        ),
      ).toThrow("Invalid response: invalid envelope");
    });
  });
});

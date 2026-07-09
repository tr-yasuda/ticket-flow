import { describe, expect, it } from "vitest";

import {
  apiErrorResponseSchema,
  apiPaginationMetaSchema,
  apiPaginatedEnvelopeSchema,
  apiSuccessEnvelopeSchema,
} from "./api-response-schema";

describe("apiSuccessEnvelopeSchema", () => {
  it("success: true と data を持つレスポンスを受け入れる", () => {
    const result = apiSuccessEnvelopeSchema.safeParse({
      success: true,
      data: { value: 1 },
    });
    expect(result.success).toBe(true);
  });

  it("success: false のレスポンスを拒否する", () => {
    const result = apiSuccessEnvelopeSchema.safeParse({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "error" },
    });
    expect(result.success).toBe(false);
  });
});

describe("apiErrorResponseSchema", () => {
  it("有効なエラーレスポンスを受け入れる", () => {
    const result = apiErrorResponseSchema.safeParse({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "入力内容を確認してください",
      },
    });
    expect(result.success).toBe(true);
  });

  it("未知のエラーコードを拒否する", () => {
    const result = apiErrorResponseSchema.safeParse({
      success: false,
      error: { code: "UNKNOWN_CODE", message: "error" },
    });
    expect(result.success).toBe(false);
  });
});

describe("apiPaginationMetaSchema", () => {
  it("有効なページネーションメタを受け入れる", () => {
    const result = apiPaginationMetaSchema.safeParse({
      page: 1,
      perPage: 20,
      total: 40,
      totalPages: 2,
    });
    expect(result.success).toBe(true);
  });

  it("perPage の上限を超える値を拒否する", () => {
    const result = apiPaginationMetaSchema.safeParse({
      page: 1,
      perPage: 101,
      total: 0,
      totalPages: 0,
    });
    expect(result.success).toBe(false);
  });

  it("total が 0 の場合は totalPages も 0 でなければならない", () => {
    const result = apiPaginationMetaSchema.safeParse({
      page: 1,
      perPage: 20,
      total: 0,
      totalPages: 1,
    });
    expect(result.success).toBe(false);
  });

  it("total と totalPages が一致しない場合を拒否する", () => {
    const result = apiPaginationMetaSchema.safeParse({
      page: 1,
      perPage: 20,
      total: 40,
      totalPages: 1,
    });
    expect(result.success).toBe(false);
  });
});

describe("apiPaginatedEnvelopeSchema", () => {
  it("ページネーション付き success envelope を受け入れる", () => {
    const result = apiPaginatedEnvelopeSchema.safeParse({
      success: true,
      data: { items: [] },
      meta: { page: 1, perPage: 20, total: 0, totalPages: 0 },
    });
    expect(result.success).toBe(true);
  });

  it("meta が欠けている envelope を拒否する", () => {
    const result = apiPaginatedEnvelopeSchema.safeParse({
      success: true,
      data: { items: [] },
    });
    expect(result.success).toBe(false);
  });
});

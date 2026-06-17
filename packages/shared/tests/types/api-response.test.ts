import { describe, expect, it } from "vitest";

import {
  API_ERROR_CODE_TO_HTTP_STATUS,
  ApiErrorCode,
  HTTP_STATUS_TO_API_ERROR_CODE,
  createApiErrorResponse,
  createApiPaginatedSuccessResponse,
  createApiSuccessResponse,
  isApiErrorResponse,
  isApiSuccessResponse,
} from "../../src/index.js";

describe("createApiSuccessResponse", () => {
  it("{ success: true, data: T } の形状を返す", () => {
    const response = createApiSuccessResponse({ id: "1", name: "test" });

    expect(response).toStrictEqual({
      success: true,
      data: { id: "1", name: "test" },
    });
  });
});

describe("createApiPaginatedSuccessResponse", () => {
  it("{ success: true, data: T, meta } の形状を返す", () => {
    const response = createApiPaginatedSuccessResponse([{ id: "1" }], {
      page: 1,
      perPage: 10,
      total: 100,
      totalPages: 10,
    });

    expect(response).toStrictEqual({
      success: true,
      data: [{ id: "1" }],
      meta: {
        page: 1,
        perPage: 10,
        total: 100,
        totalPages: 10,
      },
    });
  });
});

describe("createApiErrorResponse", () => {
  it("{ success: false, error: { code, message } } の形状を返す", () => {
    const response = createApiErrorResponse(
      ApiErrorCode.INTERNAL_ERROR,
      "予期しないエラーが発生しました",
    );

    expect(response).toStrictEqual({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "予期しないエラーが発生しました",
      },
    });
  });

  it("details が指定された場合は error.details に含める", () => {
    const details = [{ field: "email", message: "不正な形式です" }];
    const response = createApiErrorResponse(
      ApiErrorCode.VALIDATION_ERROR,
      "入力内容を確認してください",
      details,
    );

    expect(response).toStrictEqual({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "入力内容を確認してください",
        details,
      },
    });
  });
});

describe("isApiSuccessResponse / isApiErrorResponse", () => {
  it("成功レスポンスを判別できる", () => {
    const success = createApiSuccessResponse({ value: 1 });

    expect(isApiSuccessResponse(success)).toBe(true);
    expect(isApiErrorResponse(success)).toBe(false);
  });

  it("エラーレスポンスを判別できる", () => {
    const error = createApiErrorResponse(
      ApiErrorCode.NOT_FOUND,
      "見つかりません",
    );

    expect(isApiSuccessResponse(error)).toBe(false);
    expect(isApiErrorResponse(error)).toBe(true);
  });

  it("ページネーション付き成功レスポンスの型を保持して判別できる", () => {
    const paginated = createApiPaginatedSuccessResponse([{ id: "1" }], {
      page: 1,
      perPage: 10,
      total: 100,
      totalPages: 10,
    });

    expect(isApiSuccessResponse(paginated)).toBe(true);
    if (isApiSuccessResponse(paginated)) {
      expect(paginated.meta).toStrictEqual({
        page: 1,
        perPage: 10,
        total: 100,
        totalPages: 10,
      });
    }
  });
});

describe("ApiErrorCode", () => {
  it("定義されたすべてのエラーコードの値が一意である", () => {
    const codes = Object.values(ApiErrorCode);
    const uniqueCodes = new Set(codes);

    expect(uniqueCodes.size).toBe(codes.length);
  });

  it("すべてのエラーコードが HTTP status 対応表に含まれている", () => {
    const codes = Object.values(ApiErrorCode);
    const mappedCodes = Object.keys(API_ERROR_CODE_TO_HTTP_STATUS);

    expect(mappedCodes.sort()).toEqual(codes.sort());
  });
});

describe("API_ERROR_CODE_TO_HTTP_STATUS", () => {
  it("すべての対応値が有効な HTTP status code である", () => {
    const statuses = Object.values(API_ERROR_CODE_TO_HTTP_STATUS);

    for (const status of statuses) {
      expect(status).toBeGreaterThanOrEqual(100);
      expect(status).toBeLessThanOrEqual(599);
    }
  });

  it("認証系エラーは 401/403 に対応している", () => {
    expect(API_ERROR_CODE_TO_HTTP_STATUS[ApiErrorCode.AUTH_UNAUTHORIZED]).toBe(
      401,
    );
    expect(API_ERROR_CODE_TO_HTTP_STATUS[ApiErrorCode.AUTH_TOKEN_EXPIRED]).toBe(
      401,
    );
    expect(API_ERROR_CODE_TO_HTTP_STATUS[ApiErrorCode.AUTH_TOKEN_INVALID]).toBe(
      401,
    );
    expect(API_ERROR_CODE_TO_HTTP_STATUS[ApiErrorCode.AUTH_FORBIDDEN]).toBe(
      403,
    );
  });

  it("バリデーションエラーは 400 に対応している", () => {
    expect(API_ERROR_CODE_TO_HTTP_STATUS[ApiErrorCode.VALIDATION_ERROR]).toBe(
      400,
    );
  });

  it("NOT_FOUND は 404 に対応している", () => {
    expect(API_ERROR_CODE_TO_HTTP_STATUS[ApiErrorCode.NOT_FOUND]).toBe(404);
  });

  it("INTERNAL_ERROR は 500 に対応している", () => {
    expect(API_ERROR_CODE_TO_HTTP_STATUS[ApiErrorCode.INTERNAL_ERROR]).toBe(
      500,
    );
  });
});

describe("HTTP_STATUS_TO_API_ERROR_CODE", () => {
  it("主要な HTTP status code に対して汎用エラーコードが対応している", () => {
    expect(HTTP_STATUS_TO_API_ERROR_CODE[400]).toBe(ApiErrorCode.BAD_REQUEST);
    expect(HTTP_STATUS_TO_API_ERROR_CODE[401]).toBe(
      ApiErrorCode.AUTH_UNAUTHORIZED,
    );
    expect(HTTP_STATUS_TO_API_ERROR_CODE[403]).toBe(
      ApiErrorCode.AUTH_FORBIDDEN,
    );
    expect(HTTP_STATUS_TO_API_ERROR_CODE[404]).toBe(ApiErrorCode.NOT_FOUND);
    expect(HTTP_STATUS_TO_API_ERROR_CODE[409]).toBe(ApiErrorCode.CONFLICT);
    expect(HTTP_STATUS_TO_API_ERROR_CODE[429]).toBe(ApiErrorCode.RATE_LIMITED);
    expect(HTTP_STATUS_TO_API_ERROR_CODE[500]).toBe(
      ApiErrorCode.INTERNAL_ERROR,
    );
    expect(HTTP_STATUS_TO_API_ERROR_CODE[503]).toBe(
      ApiErrorCode.SERVICE_UNAVAILABLE,
    );
  });

  it("対応表に含まれない status code は undefined を返す", () => {
    expect(HTTP_STATUS_TO_API_ERROR_CODE[418]).toBeUndefined();
  });
});

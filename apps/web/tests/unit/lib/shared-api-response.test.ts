import {
  ApiErrorCode,
  type ApiResponse,
  createApiErrorResponse,
  createApiSuccessResponse,
  isApiErrorResponse,
  isApiSuccessResponse,
} from "@ticket-flow/shared";
import { describe, expect, it } from "vitest";

describe("@ticket-flow/shared API response types", () => {
  it("フロントエンドから共有型を import して成功レスポンスを組み立てられる", () => {
    const response: ApiResponse<{ message: string }> = createApiSuccessResponse(
      {
        message: "ok",
      },
    );

    expect(isApiSuccessResponse(response)).toBe(true);
    expect(isApiErrorResponse(response)).toBe(false);
  });

  it("フロントエンドから共有型を import してエラーレスポンスを組み立てられる", () => {
    const response: ApiResponse<{ message: string }> = createApiErrorResponse(
      ApiErrorCode.AUTH_UNAUTHORIZED,
      "認証が必要です",
    );

    expect(isApiSuccessResponse(response)).toBe(false);
    expect(isApiErrorResponse(response)).toBe(true);
    expect(response.success).toBe(false);
    if (response.success === false) {
      expect(response.error.code).toBe("AUTH_UNAUTHORIZED");
    }
  });
});

import { describe, expect, it, vi } from "vitest";

import {
  API_ERROR_MESSAGES,
  getApiErrorMessage,
  reportApiError,
} from "@/lib/api-error";

describe("getApiErrorMessage", () => {
  it("TypeError はネットワークエラーとして扱う", () => {
    expect(getApiErrorMessage(new TypeError("Failed to fetch"))).toBe(
      API_ERROR_MESSAGES.network,
    );
  });

  it("400 番台は入力内容の確認を促す", () => {
    expect(getApiErrorMessage({ status: 400 })).toBe(API_ERROR_MESSAGES.client);
    expect(getApiErrorMessage({ status: 422 })).toBe(API_ERROR_MESSAGES.client);
  });

  it("500 番台は時間をおいて再試行を促す", () => {
    expect(getApiErrorMessage({ status: 500 })).toBe(API_ERROR_MESSAGES.server);
    expect(getApiErrorMessage({ status: 503 })).toBe(API_ERROR_MESSAGES.server);
  });

  it("想定外のエラーはデフォルトメッセージを返す", () => {
    expect(getApiErrorMessage(new Error("unexpected"))).toBe(
      API_ERROR_MESSAGES.default,
    );
    expect(getApiErrorMessage("unknown")).toBe(API_ERROR_MESSAGES.default);
    expect(getApiErrorMessage(null)).toBe(API_ERROR_MESSAGES.default);
  });
});

describe("reportApiError", () => {
  it("エラー通知関数にユーザー向けメッセージを渡す", () => {
    const notifyError = vi.fn();

    reportApiError({ status: 422 }, notifyError);

    expect(notifyError).toHaveBeenCalledTimes(1);
    expect(notifyError).toHaveBeenCalledWith(API_ERROR_MESSAGES.client);
  });
});

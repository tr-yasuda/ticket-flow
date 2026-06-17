import type { ZodError } from "zod";

import type { ApiValidationErrorDetail } from "../types/api-response.js";

/**
 * Zod の検証エラーを API 共通エラー形式の詳細情報に変換する。
 *
 * `issue.path[0]` をフィールド名、`issue.message` をメッセージとして使用する。
 * `path[0]` が文字列でない場合（配列インデックス等）は無視する。
 */
export function mapZodErrorToValidationDetails(
  error: ZodError,
): ApiValidationErrorDetail[] {
  const details: ApiValidationErrorDetail[] = [];

  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field !== "string") {
      continue;
    }
    details.push({ field, message: issue.message });
  }

  return details;
}

import type { ApiValidationErrorDetail } from "../types/api-response.js";

type PathSegment = PropertyKey | { readonly key: PropertyKey };

type ValidationIssue = {
  readonly message: string;
  readonly path?: readonly PathSegment[];
};

function resolveFieldName(
  segment: PathSegment | undefined,
): string | undefined {
  if (typeof segment === "string") {
    return segment;
  }
  if (typeof segment === "number") {
    return undefined;
  }
  if (segment !== null && typeof segment === "object") {
    const key = segment.key;
    return typeof key === "string" ? key : undefined;
  }
  return undefined;
}

/**
 * 検証エラーの issues を API 共通エラー形式の詳細情報に変換する。
 *
 * `issue.path[0]` をフィールド名、`issue.message` をメッセージとして使用する。
 * フィールド名が文字列でない場合（配列インデックス等）は無視する。
 */
export function mapZodErrorToValidationDetails(
  issues: readonly ValidationIssue[],
): ApiValidationErrorDetail[] {
  const details: ApiValidationErrorDetail[] = [];

  for (const issue of issues) {
    const field = resolveFieldName(issue.path?.[0]);
    if (field === undefined) {
      continue;
    }
    details.push({ field, message: issue.message });
  }

  return details;
}

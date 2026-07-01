export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * `{ success: true, data: unknown }` 形式の API 成功レスポンス envelope
 * であるかを判定する。
 *
 * `data` の内容までは検証しない。`data` が存在することだけを確認する。
 */
export function isApiSuccessEnvelope(
  value: unknown,
): value is Readonly<{ success: true; data: unknown }> {
  return isRecord(value) && value.success === true && "data" in value;
}

/**
 * `{ success: true, data: unknown, meta: Record<string, unknown> }` 形式の
 * ページネーション付き API 成功レスポンス envelope であるかを判定する。
 *
 * `data` / `meta` の内容までは検証しない。`meta` が record であること
 * （配列は除く）だけを確認する。
 */
export function isApiPaginatedEnvelope(value: unknown): value is Readonly<{
  success: true;
  data: unknown;
  meta: Record<string, unknown>;
}> {
  return (
    isRecord(value) &&
    value.success === true &&
    "data" in value &&
    isRecord(value.meta)
  );
}

/**
 * API 成功レスポンス envelope から `data` を取り出し、呼び出し元の型
 * ガードで検証する。
 *
 * envelope 形状が不正な場合と data 検証が失敗した場合は、それぞれ
 * `<message>: invalid envelope` / `<message>: invalid data` で例外を投げる。
 */
export function extractData<T>(
  body: unknown,
  isData: (data: unknown) => data is T,
  message = "Invalid response",
): T {
  if (!isApiSuccessEnvelope(body)) {
    throw new Error(`${message}: invalid envelope`);
  }

  const { data } = body;
  if (!isData(data)) {
    throw new Error(`${message}: invalid data`);
  }

  return data;
}

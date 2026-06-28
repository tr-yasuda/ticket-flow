function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function getApiBaseUrl(): string {
  const value = import.meta.env.VITE_API_BASE_URL?.trim();
  // 空文字列も未設定と同様に扱い、"/api" にフォールバックする。
  // ?? では空文字列はフォールバック対象にならないため || を使用している。
  return value || "/api";
}

export function buildApiUrl(path: string): string {
  const base = getApiBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (isAbsoluteUrl(base)) {
    const url = new URL(base);
    url.pathname = `${url.pathname.replace(/\/+$/, "")}${normalizedPath}`;
    return url.toString();
  }

  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${normalizedBase}${normalizedPath}`;
}

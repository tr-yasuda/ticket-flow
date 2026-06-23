export function extractBearerToken(authorization?: string): string | null {
  if (authorization === undefined) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match?.[1] ?? null;
}

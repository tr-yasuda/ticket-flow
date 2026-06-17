export function extractBearerToken(
  authorization: string | undefined,
): string | null {
  if (authorization === undefined) {
    return null;
  }
  const trimmed = authorization.trim();
  const match = /^Bearer\s+(.+)$/i.exec(trimmed);
  if (match === null) {
    return null;
  }
  return match[1].trim();
}

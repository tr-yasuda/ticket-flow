let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setTokens(
  newAccessToken: string,
  newRefreshToken: string,
): void {
  accessToken = newAccessToken;
  refreshToken = newRefreshToken;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
}

let accessToken: string | null = null;
let refreshToken: string | null = null;

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function setTokens(
  newAccessToken: string,
  newRefreshToken: string,
): void {
  accessToken = newAccessToken;
  refreshToken = newRefreshToken;
  notify();
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
  notify();
}

export function subscribeAccessToken(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

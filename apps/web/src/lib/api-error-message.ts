export const API_ERROR_MESSAGES = {
  default: "処理に失敗しました。時間をおいて再度お試しください。",
  network: "通信に失敗しました。ネットワーク環境を確認してください。",
  client: "入力内容を確認してください。",
  server: "システムエラーが発生しました。時間をおいて再度お試しください。",
} as const;

export type ErrorNotifier = (message: string) => void;

function hasStatusProperty(error: unknown): error is { status: number } {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number"
  );
}

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof TypeError) {
    return API_ERROR_MESSAGES.network;
  }

  if (hasStatusProperty(error)) {
    const { status } = error;

    if (status >= 500) {
      return API_ERROR_MESSAGES.server;
    }

    if (status >= 400) {
      return API_ERROR_MESSAGES.client;
    }
  }

  return API_ERROR_MESSAGES.default;
}

export function reportApiError(
  error: unknown,
  notifyError: ErrorNotifier,
): void {
  notifyError(getApiErrorMessage(error));
}

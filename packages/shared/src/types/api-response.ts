/**
 * API エラーコード。
 *
 * 命名規則:
 * - ドメイン/関心事を大文字スネークケースのプレフィックスとする（AUTH_, VALIDATION_ 等）
 * - 汎用的なものはプレフィックスなし（NOT_FOUND, INTERNAL_ERROR 等）
 */
export const ApiErrorCode = {
  // 400 Bad Request
  BAD_REQUEST: "BAD_REQUEST",
  VALIDATION_ERROR: "VALIDATION_ERROR",

  // 401 Unauthorized
  AUTH_UNAUTHORIZED: "AUTH_UNAUTHORIZED",
  AUTH_TOKEN_EXPIRED: "AUTH_TOKEN_EXPIRED",
  AUTH_TOKEN_INVALID: "AUTH_TOKEN_INVALID",

  // 403 Forbidden
  AUTH_FORBIDDEN: "AUTH_FORBIDDEN",

  // 404 Not Found
  NOT_FOUND: "NOT_FOUND",

  // 409 Conflict
  CONFLICT: "CONFLICT",

  // 429 Too Many Requests
  RATE_LIMITED: "RATE_LIMITED",

  // 500 Internal Server Error
  INTERNAL_ERROR: "INTERNAL_ERROR",

  // 503 Service Unavailable
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;

export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

/**
 * API エラー詳細。
 *
 * `details` はエラーコードに応じた追加情報を格納する。
 * バリデーションエラーの場合はフィールド単位のメッセージを配列で持つ。
 */
export type ApiValidationErrorDetail = Readonly<{
  field: string;
  message: string;
}>;

export type ApiError = Readonly<{
  code: ApiErrorCode;
  message: string;
  details?: unknown;
}>;

/**
 * 成功レスポンス。
 */
export type ApiSuccessResponse<T> = Readonly<{
  success: true;
  data: T;
}>;

/**
 * ページネーション metadata。
 *
 * 将来の拡張用。リスト API の成功レスポンスに含める。
 */
export type ApiPaginationMeta = Readonly<{
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}>;

/**
 * ページネーション付き成功レスポンス。
 */
export type ApiPaginatedSuccessResponse<T> = ApiSuccessResponse<T> &
  Readonly<{
    meta: ApiPaginationMeta;
  }>;

/**
 * エラーレスポンス。
 */
export type ApiErrorResponse = Readonly<{
  success: false;
  error: ApiError;
}>;

/**
 * API レスポンスの union 型。
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * API エラーコードから HTTP status code への対応表。
 */
export const API_ERROR_CODE_TO_HTTP_STATUS: Record<ApiErrorCode, number> = {
  [ApiErrorCode.BAD_REQUEST]: 400,
  [ApiErrorCode.VALIDATION_ERROR]: 400,
  [ApiErrorCode.AUTH_UNAUTHORIZED]: 401,
  [ApiErrorCode.AUTH_TOKEN_EXPIRED]: 401,
  [ApiErrorCode.AUTH_TOKEN_INVALID]: 401,
  [ApiErrorCode.AUTH_FORBIDDEN]: 403,
  [ApiErrorCode.NOT_FOUND]: 404,
  [ApiErrorCode.CONFLICT]: 409,
  [ApiErrorCode.RATE_LIMITED]: 429,
  [ApiErrorCode.INTERNAL_ERROR]: 500,
  [ApiErrorCode.SERVICE_UNAVAILABLE]: 503,
};

/**
 * HTTP status code から最も一般的な API エラーコードへの対応表。
 *
 * 1 つの status code に複数のコードが該当する場合は、
 * 最も汎用的なコードを選択している。
 */
export const HTTP_STATUS_TO_API_ERROR_CODE: Record<number, ApiErrorCode> = {
  400: ApiErrorCode.BAD_REQUEST,
  401: ApiErrorCode.AUTH_UNAUTHORIZED,
  403: ApiErrorCode.AUTH_FORBIDDEN,
  404: ApiErrorCode.NOT_FOUND,
  409: ApiErrorCode.CONFLICT,
  429: ApiErrorCode.RATE_LIMITED,
  500: ApiErrorCode.INTERNAL_ERROR,
  503: ApiErrorCode.SERVICE_UNAVAILABLE,
};

export function createApiSuccessResponse<T>(data: T): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
  };
}

export function createApiPaginatedSuccessResponse<T>(
  data: T,
  meta: ApiPaginationMeta,
): ApiPaginatedSuccessResponse<T> {
  return {
    success: true,
    data,
    meta,
  };
}

export function createApiErrorResponse(
  code: ApiErrorCode,
  message: string,
  details?: unknown,
): ApiErrorResponse {
  const response: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
    },
  };

  if (details !== undefined) {
    return {
      ...response,
      error: {
        ...response.error,
        details,
      },
    };
  }

  return response;
}

export function isApiSuccessResponse<T>(
  response: ApiResponse<T>,
): response is ApiSuccessResponse<T> {
  return response.success === true;
}

export function isApiErrorResponse<T>(
  response: ApiResponse<T>,
): response is ApiErrorResponse {
  return response.success === false;
}

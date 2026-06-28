import { type ApiErrorResponse } from "@ticket-flow/shared";
import { type AfterResponseHook } from "ky";

export type ApiErrorDetail = Readonly<{
  field: string;
  message: string;
}>;

function isApiErrorDetail(value: unknown): value is ApiErrorDetail {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).field === "string" &&
    typeof (value as Record<string, unknown>).message === "string"
  );
}

export function parseDetails(
  value: unknown,
): ReadonlyArray<ApiErrorDetail> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const details = value.filter(isApiErrorDetail);
  return details.length > 0 ? details : undefined;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: ReadonlyArray<ApiErrorDetail>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function isApiErrorResponseLike(
  body: unknown,
): body is ApiErrorResponse {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const response = body as { success?: unknown; error?: unknown };
  if (response.success !== false) {
    return false;
  }
  if (typeof response.error !== "object" || response.error === null) {
    return false;
  }
  const error = response.error as {
    code?: unknown;
    message?: unknown;
  };
  return typeof error.code === "string" && typeof error.message === "string";
}

export const handleApiErrorResponse: AfterResponseHook = async (
  _request,
  _options,
  response,
) => {
  if (response.ok) {
    return response;
  }

  const cloned = response.clone();
  try {
    const body = (await cloned.json()) as unknown;
    if (isApiErrorResponseLike(body)) {
      throw new ApiError(
        body.error.message,
        response.status,
        parseDetails(body.error.details),
      );
    }
    const legacyBody = body as { error?: unknown; details?: unknown };
    const message =
      typeof legacyBody.error === "string"
        ? legacyBody.error
        : "Request failed";
    throw new ApiError(
      message,
      response.status,
      parseDetails(legacyBody.details),
    );
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError("Request failed", response.status);
  }
};

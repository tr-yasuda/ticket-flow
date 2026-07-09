import {
  type ApiErrorResponse,
  type ApiValidationErrorDetail,
} from "@ticket-flow/shared";
import { type AfterResponseHook } from "ky";

import {
  apiErrorDetailSchema,
  apiErrorResponseSchema,
} from "@/lib/schemas/api-response-schema";

export type ApiErrorDetail = ApiValidationErrorDetail;
export type ApiErrorSource = "client" | "server";

function parseApiErrorDetails(
  value: unknown,
): ReadonlyArray<ApiErrorDetail> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const details = value
    .map((item) => apiErrorDetailSchema.safeParse(item))
    .filter(
      (result): result is { success: true; data: ApiErrorDetail } =>
        result.success,
    )
    .map((result) => result.data);

  return details.length > 0 ? details : undefined;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: ReadonlyArray<ApiErrorDetail>,
    public readonly source: ApiErrorSource = "client",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function isApiErrorResponseLike(body: unknown): body is ApiErrorResponse {
  return apiErrorResponseSchema.safeParse(body).success;
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
        parseApiErrorDetails(body.error.details),
        "server",
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
      parseApiErrorDetails(legacyBody.details),
      "server",
    );
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError("Request failed", response.status, undefined, "client");
  }
};

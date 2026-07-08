import {
  apiPaginatedEnvelopeSchema,
  apiPaginationMetaSchema,
  apiSuccessEnvelopeSchema,
} from "@ticket-flow/shared";
import { type ZodType, type z } from "zod";

export class ApiResponseValidationError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ApiResponseValidationError";
  }
}

export function extractData<T>(
  body: unknown,
  schema: ZodType<T>,
  message = "Invalid response",
): T {
  const envelopeResult = apiSuccessEnvelopeSchema.safeParse(body);
  if (!envelopeResult.success) {
    throw new ApiResponseValidationError(`${message}: invalid envelope`, body);
  }

  const dataResult = schema.safeParse(envelopeResult.data.data);
  if (!dataResult.success) {
    throw new ApiResponseValidationError(
      `${message}: invalid data`,
      dataResult.error,
    );
  }

  return dataResult.data;
}

export function extractPaginatedData<T>(
  body: unknown,
  schema: ZodType<T>,
  message = "Invalid response",
): T {
  const { data } = extractPaginatedResponse(body, schema, message);
  return data;
}

export function extractPaginatedResponse<T>(
  body: unknown,
  schema: ZodType<T>,
  message = "Invalid response",
): { data: T; meta: z.infer<typeof apiPaginationMetaSchema> } {
  const envelopeResult = apiPaginatedEnvelopeSchema.safeParse(body);
  if (!envelopeResult.success) {
    throw new ApiResponseValidationError(`${message}: invalid envelope`, body);
  }

  const dataResult = schema.safeParse(envelopeResult.data.data);
  if (!dataResult.success) {
    throw new ApiResponseValidationError(
      `${message}: invalid data`,
      dataResult.error,
    );
  }

  return { data: dataResult.data, meta: envelopeResult.data.meta };
}

export type { z };

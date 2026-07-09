import { type ZodType, type z } from "zod";

import {
  apiPaginatedEnvelopeSchema,
  apiPaginationMetaSchema,
  apiSuccessEnvelopeSchema,
} from "@/lib/schemas/api-response-schema";

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
    throw new ApiResponseValidationError(
      `${message}: invalid envelope`,
      envelopeResult.error,
    );
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

export function extractPaginatedResponse<T>(
  body: unknown,
  schema: ZodType<T>,
  message = "Invalid response",
): { data: T; meta: z.infer<typeof apiPaginationMetaSchema> } {
  const envelopeResult = apiPaginatedEnvelopeSchema.safeParse(body);
  if (!envelopeResult.success) {
    throw new ApiResponseValidationError(
      `${message}: invalid envelope`,
      envelopeResult.error,
    );
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

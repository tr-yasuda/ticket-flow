import { z } from "zod";

import { ApiErrorCode } from "../types/api-response.js";

const apiErrorCodeSchema = z.enum([
  ApiErrorCode.BAD_REQUEST,
  ApiErrorCode.VALIDATION_ERROR,
  ApiErrorCode.AUTH_UNAUTHORIZED,
  ApiErrorCode.AUTH_TOKEN_EXPIRED,
  ApiErrorCode.AUTH_TOKEN_INVALID,
  ApiErrorCode.AUTH_FORBIDDEN,
  ApiErrorCode.NOT_FOUND,
  ApiErrorCode.CONFLICT,
  ApiErrorCode.RATE_LIMITED,
  ApiErrorCode.INTERNAL_ERROR,
  ApiErrorCode.SERVICE_UNAVAILABLE,
]);

export const apiErrorDetailSchema = z.object({
  field: z.string(),
  message: z.string(),
});

export const apiErrorSchema = z.object({
  code: apiErrorCodeSchema,
  message: z.string(),
  details: z.unknown().optional(),
});

export const apiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: apiErrorSchema,
});

export const apiSuccessEnvelopeSchema = z.object({
  success: z.literal(true),
  data: z.unknown(),
});

export const apiPaginationMetaSchema = z.object({
  page: z.number().int().positive(),
  perPage: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export const apiPaginatedEnvelopeSchema = apiSuccessEnvelopeSchema.extend({
  meta: apiPaginationMetaSchema,
});

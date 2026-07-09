import { ApiErrorCode } from "@ticket-flow/shared";
import { z } from "zod";

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

const MAX_PER_PAGE = 100;

export const apiPaginationMetaSchema = z
  .object({
    page: z.number().int().positive(),
    perPage: z.number().int().positive().max(MAX_PER_PAGE),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .refine(
    (data) => {
      if (data.total === 0) {
        return data.totalPages === 0;
      }
      const expectedTotalPages = Math.floor(
        (data.total + data.perPage - 1) / data.perPage,
      );
      return data.totalPages === expectedTotalPages;
    },
    {
      message: "total と totalPages が一致しません",
    },
  );

export const apiPaginatedEnvelopeSchema = apiSuccessEnvelopeSchema.extend({
  meta: apiPaginationMetaSchema,
});

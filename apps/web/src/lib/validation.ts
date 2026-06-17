import type { ZodError } from "zod";

import { ApiError } from "./api-client";

export type FieldErrors = Readonly<Record<string, string>>;

export function mapZodErrorToFields(error: ZodError): FieldErrors {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field !== "string") {
      continue;
    }
    errors[field] = issue.message;
  }
  return errors;
}

export function mapApiErrorToFields(error: unknown): FieldErrors {
  if (!(error instanceof ApiError) || error.details === undefined) {
    return {};
  }
  const errors: Record<string, string> = {};
  for (const detail of error.details) {
    errors[detail.field] = detail.message;
  }
  return errors;
}

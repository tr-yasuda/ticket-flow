import type {
  ApiErrorCode,
  ApiValidationErrorDetail,
} from "@ticket-flow/shared";

import { HttpStatus } from "../lib/http-status.js";

export type ErrorMapping = Readonly<{
  code: ApiErrorCode;
  status:
    | typeof HttpStatus.BAD_REQUEST
    | typeof HttpStatus.NOT_FOUND
    | typeof HttpStatus.FORBIDDEN
    | typeof HttpStatus.CONFLICT
    | typeof HttpStatus.INTERNAL_SERVER_ERROR;
  message: string;
  details?: ApiValidationErrorDetail[];
}>;

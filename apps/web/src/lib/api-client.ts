import ky from "ky";

import { addAuthHeader, handleUnauthorizedResponse } from "./api-auth-hooks";
import { getApiBaseUrl } from "./api-base-url";
import {
  ApiError,
  handleApiErrorResponse,
  type ApiErrorDetail,
} from "./api-error";

export { ApiError, type ApiErrorDetail };

const RETRYABLE_HTTP_STATUSES = [408, 429, 500, 502, 503, 504] as const;

export const apiClient = ky.create({
  prefixUrl: getApiBaseUrl(),
  hooks: {
    beforeRequest: [addAuthHeader],
    afterResponse: [handleUnauthorizedResponse, handleApiErrorResponse],
  },
  retry: {
    limit: 1,
    methods: ["get"],
    shouldRetry: ({ error }) => {
      if (error instanceof TypeError) {
        return true;
      }
      return (
        error instanceof ApiError &&
        RETRYABLE_HTTP_STATUSES.includes(
          error.status as (typeof RETRYABLE_HTTP_STATUSES)[number],
        )
      );
    },
  },
});

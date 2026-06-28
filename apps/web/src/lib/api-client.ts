import ky from "ky";

import { addAuthHeader, refreshAccessToken } from "./api-auth-hooks";
import { getApiBaseUrl } from "./api-base-url";
import {
  ApiError,
  handleApiErrorResponse,
  type ApiErrorDetail,
} from "./api-error";
import { getRefreshToken } from "./token-storage";

export { ApiError, type ApiErrorDetail };

function hasRefreshToken(): boolean {
  const token = getRefreshToken();
  return token !== null && token.trim() !== "";
}

export const apiClient = ky.create({
  prefixUrl: getApiBaseUrl(),
  hooks: {
    beforeRequest: [addAuthHeader],
    beforeRetry: [refreshAccessToken],
    afterResponse: [handleApiErrorResponse],
  },
  retry: {
    limit: 1,
    methods: ["get", "post", "put", "patch", "delete"],
    shouldRetry: ({ error }) => {
      return (
        error instanceof ApiError && error.status === 401 && hasRefreshToken()
      );
    },
  },
});

import {
  ApiErrorCode,
  createApiErrorResponse,
  createApiSuccessResponse,
} from "@ticket-flow/shared";
import { http, HttpResponse } from "msw";

import { demoUser } from "../data/users.js";

function extractBearerToken(authorization: string | null): string | null {
  if (authorization === null) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match?.[1] ?? null;
}

const accessToken = "mock-access-token";
const refreshedAccessToken = `${accessToken}-refreshed`;
const refreshToken = "mock-refresh-token";

export const authHandlers = [
  http.post("/api/auth/login", async ({ request }) => {
    const body = (await request.json()) as {
      email?: unknown;
      password?: unknown;
    };

    if (body.email !== demoUser.email || body.password !== demoUser.password) {
      return HttpResponse.json(
        createApiErrorResponse(
          ApiErrorCode.AUTH_UNAUTHORIZED,
          "メールアドレスまたはパスワードが正しくありません",
        ),
        { status: 401 },
      );
    }

    return HttpResponse.json(
      createApiSuccessResponse({
        user: { id: demoUser.id, email: demoUser.email },
        accessToken,
        refreshToken,
      }),
      { status: 200 },
    );
  }),

  http.post("/api/auth/register", async ({ request }) => {
    const body = (await request.json()) as {
      email?: unknown;
      password?: unknown;
    };

    if (typeof body.email !== "string" || typeof body.password !== "string") {
      return HttpResponse.json(
        createApiErrorResponse(
          ApiErrorCode.VALIDATION_ERROR,
          "メールアドレスとパスワードは必須です",
        ),
        { status: 400 },
      );
    }

    if (body.email === demoUser.email) {
      return HttpResponse.json(
        createApiErrorResponse(
          ApiErrorCode.CONFLICT,
          "このメールアドレスは既に登録されています",
        ),
        { status: 409 },
      );
    }

    return HttpResponse.json(
      createApiSuccessResponse({
        user: { id: "mock-new-user-id", email: body.email },
        accessToken,
        refreshToken,
      }),
      { status: 201 },
    );
  }),

  http.post("/api/auth/logout", () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.get("/api/me", ({ request }) => {
    const token = extractBearerToken(request.headers.get("Authorization"));
    if (token !== accessToken && token !== refreshedAccessToken) {
      return HttpResponse.json(
        createApiErrorResponse(
          ApiErrorCode.AUTH_UNAUTHORIZED,
          "認証が必要です",
        ),
        { status: 401 },
      );
    }

    return HttpResponse.json(
      createApiSuccessResponse({
        user: { id: demoUser.id, email: demoUser.email },
      }),
      { status: 200 },
    );
  }),

  http.post("/api/auth/refresh", ({ request }) => {
    const token = extractBearerToken(request.headers.get("Authorization"));
    if (token !== refreshToken) {
      return HttpResponse.json(
        createApiErrorResponse(
          ApiErrorCode.AUTH_UNAUTHORIZED,
          "無効なリフレッシュトークンです",
        ),
        { status: 401 },
      );
    }

    return HttpResponse.json(
      createApiSuccessResponse({ accessToken: refreshedAccessToken }),
      { status: 200 },
    );
  }),
];

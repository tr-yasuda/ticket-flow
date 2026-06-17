import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import type { TransactionRunner } from "../application/transaction-runner.js";
import type { OrganizationMemberRepository } from "../domain/organization-member-repository.js";
import type { OrganizationRepository } from "../domain/organization-repository.js";
import type { RefreshTokenRepository } from "../domain/refresh-token-repository.js";
import type { UserRepository } from "../domain/user-repository.js";
import { createCreateOrganizationHandler } from "./handlers/create-organization-handler.js";
import { createLoginHandler } from "./handlers/login-handler.js";
import { createLogoutHandler } from "./handlers/logout-handler.js";
import { createMeHandler } from "./handlers/me-handler.js";
import { createRefreshHandler } from "./handlers/refresh-handler.js";
import { createRegisterHandler } from "./handlers/register-handler.js";
import { createAuthMiddleware } from "./middleware/auth-middleware.js";

export type AppDependencies = Readonly<{
  userRepository: UserRepository;
  refreshTokenRepository: RefreshTokenRepository;
  organizationRepository: OrganizationRepository;
  organizationMemberRepository: OrganizationMemberRepository;
  transactionRunner: TransactionRunner;
  hashPassword: (plainPassword: string) => Promise<string>;
  verifyPassword: (
    plainPassword: string,
    hashedPassword: string,
  ) => Promise<boolean>;
  generateAccessToken: (userId: string) => Promise<string>;
  generateRefreshToken: (userId: string) => Promise<string>;
  verifyAccessToken: (token: string) => Promise<{ userId: string }>;
  verifyRefreshToken: (token: string) => Promise<{ userId: string }>;
  hashRefreshToken: (token: string) => string;
}>;

export function createApp(deps: AppDependencies): Hono {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return err.getResponse();
    }
    console.error("Unexpected error:", err);
    return c.json({ error: "Internal Server Error" }, 500);
  });
  app.post("/api/auth/register", createRegisterHandler(deps));
  app.post("/api/auth/login", createLoginHandler(deps));
  app.post("/api/auth/logout", createLogoutHandler(deps));
  app.post("/api/auth/refresh", createRefreshHandler(deps));

  const authMiddleware = createAuthMiddleware(deps);
  app.get("/api/me", authMiddleware, createMeHandler(deps));
  app.post(
    "/api/organizations",
    authMiddleware,
    createCreateOrganizationHandler(deps),
  );

  return app;
}

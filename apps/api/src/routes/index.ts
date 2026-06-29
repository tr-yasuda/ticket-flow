import { ApiErrorCode, createApiErrorResponse } from "@ticket-flow/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { authMiddleware } from "../controllers/auth-middleware.js";
import { HttpStatus } from "../lib/http-status.js";
import { prisma } from "../lib/prisma.js";
import { configureAuthRoutes } from "./auth.js";
import { configureInvitationRoutes } from "./invitations.js";
import { configureMeRoutes } from "./me.js";
import { configureOrganizationRoutes } from "./organizations.js";

export function createApp(): Hono {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return err.getResponse();
    }
    console.error("Unexpected error:", err);
    return c.json(
      createApiErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        "Internal Server Error",
      ),
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  });

  // NOTE: /api/health は liveness/readiness 用途のため、軽量な DB ping を行う。
  // レート制限は意図的に適用していない。負荷対策が必要になった場合は別途検討する。
  app.get("/api/health", async (c) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return c.json({ status: "ok" });
    } catch (error) {
      console.error("Health check failed:", error);
      return c.json(
        createApiErrorResponse(
          ApiErrorCode.SERVICE_UNAVAILABLE,
          "Database connection failed",
        ),
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  });

  app.route("/api/auth", configureAuthRoutes());
  app.route("/api/invitations", configureInvitationRoutes());

  app.use("/api/me/*", authMiddleware);
  app.route("/api/me", configureMeRoutes());

  app.use("/api/organizations/*", authMiddleware);
  app.route("/api/organizations", configureOrganizationRoutes());

  return app;
}

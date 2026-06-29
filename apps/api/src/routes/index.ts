import { ApiErrorCode, createApiErrorResponse } from "@ticket-flow/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { authMiddleware } from "../controllers/auth-middleware.js";
import { HttpStatus } from "../lib/http-status.js";
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

  app.get("/api/health", (c) => c.json({ status: "ok" }));

  app.route("/api/auth", configureAuthRoutes());
  app.route("/api/invitations", configureInvitationRoutes());

  app.use("/api/me/*", authMiddleware);
  app.route("/api/me", configureMeRoutes());

  app.use("/api/organizations/*", authMiddleware);
  app.route("/api/organizations", configureOrganizationRoutes());

  return app;
}

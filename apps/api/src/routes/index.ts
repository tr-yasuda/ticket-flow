import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { authMiddleware } from "../controllers/auth-middleware.js";
import { createAuthRoutes } from "./auth.js";
import { createMeRoutes } from "./me.js";
import { createOrganizationRoutes } from "./organizations.js";

export function createApp(): Hono {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return err.getResponse();
    }
    console.error("Unexpected error:", err);
    return c.json({ error: "Internal Server Error" }, 500);
  });

  app.route("/api/auth", createAuthRoutes());
  app.use("/api/me/*", authMiddleware);
  app.route("/api/me", createMeRoutes());
  app.use("/api/organizations/*", authMiddleware);
  app.route("/api/organizations", createOrganizationRoutes());

  return app;
}

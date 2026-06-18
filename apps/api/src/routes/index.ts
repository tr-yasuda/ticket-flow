import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { authMiddleware } from "../controllers/auth-middleware.js";
import { configureAuthRoutes } from "./auth.js";
import { configureMeRoutes } from "./me.js";
import { configureOrganizationRoutes } from "./organizations.js";

export function createApp(): Hono {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return err.getResponse();
    }
    console.error("Unexpected error:", err);
    return c.json({ error: "Internal Server Error" }, 500);
  });

  const authRoutes = new Hono();
  configureAuthRoutes(authRoutes);
  app.route("/api/auth", authRoutes);

  app.use("/api/me/*", authMiddleware);
  const meRoutes = new Hono();
  configureMeRoutes(meRoutes);
  app.route("/api/me", meRoutes);

  app.use("/api/organizations/*", authMiddleware);
  const organizationRoutes = new Hono();
  configureOrganizationRoutes(organizationRoutes);
  app.route("/api/organizations", organizationRoutes);

  return app;
}

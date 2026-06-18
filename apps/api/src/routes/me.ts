import type { Hono } from "hono";

import { meController } from "../controllers/me-controller.js";

export function configureMeRoutes(routes: Hono): void {
  routes.get("/", meController);
}

import { Hono } from "hono";

import { meController } from "../controllers/me-controller.js";

export function configureMeRoutes(routes: Hono = new Hono()): Hono {
  return routes.get("/", meController);
}

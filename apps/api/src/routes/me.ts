import { Hono } from "hono";

import { meController } from "../controllers/me-controller.js";

export function createMeRoutes(): Hono {
  const routes = new Hono();
  routes.get("/", meController);
  return routes;
}

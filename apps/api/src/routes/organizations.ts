import { Hono } from "hono";

import { createOrganizationController } from "../controllers/organizations-controller.js";

export function createOrganizationRoutes(): Hono {
  const routes = new Hono();
  routes.post("/", createOrganizationController);
  return routes;
}

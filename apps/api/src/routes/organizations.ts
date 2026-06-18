import { Hono } from "hono";

import { createOrganizationController } from "../controllers/organizations-controller.js";

export function configureOrganizationRoutes(routes: Hono = new Hono()): Hono {
  return routes.post("/", createOrganizationController);
}

import type { Hono } from "hono";

import { createOrganizationController } from "../controllers/organizations-controller.js";

export function configureOrganizationRoutes(routes: Hono): void {
  routes.post("/", createOrganizationController);
}

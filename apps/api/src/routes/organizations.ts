import { sValidator } from "@hono/standard-validator";
import { createOrganizationInputSchema } from "@ticket-flow/shared";
import { Hono } from "hono";

import { organizationScopeMiddleware } from "../controllers/organization-scope-middleware.js";
import {
  createOrganizationController,
  getOrganizationController,
  getOrganizationsController,
} from "../controllers/organizations-controller.js";
import { validationHook } from "../lib/validation-hook.js";

export function configureOrganizationRoutes(routes: Hono = new Hono()): Hono {
  return routes
    .get("/", getOrganizationsController)
    .post(
      "/",
      sValidator("json", createOrganizationInputSchema, validationHook),
      createOrganizationController,
    )
    .get(
      "/:organizationId",
      organizationScopeMiddleware,
      getOrganizationController,
    );
}

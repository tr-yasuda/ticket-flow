import { sValidator } from "@hono/standard-validator";
import { createOrganizationInputSchema } from "@ticket-flow/shared";
import { Hono } from "hono";
import { z } from "zod";

import { organizationScopeMiddleware } from "../controllers/organization-scope-middleware.js";
import {
  createOrganizationController,
  getOrganizationController,
  getOrganizationMembersController,
  getOrganizationsController,
} from "../controllers/organizations-controller.js";
import { validationHook } from "../lib/validation-hook.js";

const listOrganizationMembersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export function configureOrganizationRoutes(routes: Hono = new Hono()): Hono {
  return routes
    .get("/", getOrganizationsController)
    .post(
      "/",
      sValidator("json", createOrganizationInputSchema, validationHook),
      createOrganizationController,
    )
    .get(
      "/:organizationId/members",
      organizationScopeMiddleware,
      sValidator("query", listOrganizationMembersQuerySchema, validationHook),
      getOrganizationMembersController,
    )
    .get(
      "/:organizationId",
      organizationScopeMiddleware,
      getOrganizationController,
    );
}

import { sValidator } from "@hono/standard-validator";
import { createOrganizationInputSchema } from "@ticket-flow/shared";
import { Hono } from "hono";

import { createOrganizationController } from "../controllers/organizations-controller.js";
import { validationHook } from "../lib/validation-hook.js";

export function configureOrganizationRoutes(routes: Hono = new Hono()): Hono {
  return routes.post(
    "/",
    sValidator("json", createOrganizationInputSchema, validationHook),
    createOrganizationController,
  );
}

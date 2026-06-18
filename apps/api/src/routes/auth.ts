import { sValidator } from "@hono/standard-validator";
import { loginInputSchema, registerInputSchema } from "@ticket-flow/shared";
import { Hono } from "hono";

import {
  loginController,
  logoutController,
  refreshController,
  registerController,
} from "../controllers/auth-controller.js";
import { validationHook } from "../lib/validation-hook.js";

export function configureAuthRoutes(routes: Hono = new Hono()): Hono {
  return routes
    .post(
      "/register",
      sValidator("json", registerInputSchema, validationHook),
      registerController,
    )
    .post(
      "/login",
      sValidator("json", loginInputSchema, validationHook),
      loginController,
    )
    .post("/logout", logoutController)
    .post("/refresh", refreshController);
}

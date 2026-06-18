import { Hono } from "hono";

import {
  loginController,
  logoutController,
  refreshController,
  registerController,
} from "../controllers/auth-controller.js";

export function configureAuthRoutes(routes: Hono = new Hono()): Hono {
  return routes
    .post("/register", registerController)
    .post("/login", loginController)
    .post("/logout", logoutController)
    .post("/refresh", refreshController);
}

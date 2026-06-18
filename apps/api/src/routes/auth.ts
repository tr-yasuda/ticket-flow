import type { Hono } from "hono";

import {
  loginController,
  logoutController,
  refreshController,
  registerController,
} from "../controllers/auth-controller.js";

export function configureAuthRoutes(routes: Hono): void {
  routes.post("/register", registerController);
  routes.post("/login", loginController);
  routes.post("/logout", logoutController);
  routes.post("/refresh", refreshController);
}

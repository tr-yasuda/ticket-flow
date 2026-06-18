import { Hono } from "hono";

import {
  loginController,
  logoutController,
  refreshController,
  registerController,
} from "../controllers/auth-controller.js";

export function createAuthRoutes(): Hono {
  const routes = new Hono();
  routes.post("/register", registerController);
  routes.post("/login", loginController);
  routes.post("/logout", logoutController);
  routes.post("/refresh", refreshController);
  return routes;
}

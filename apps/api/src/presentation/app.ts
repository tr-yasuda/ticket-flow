import { Hono } from "hono";

import type { RegisterUserDependencies } from "../application/register-user.js";
import { createRegisterHandler } from "./handlers/register-handler.js";

export function createApp(deps: RegisterUserDependencies): Hono {
  const app = new Hono();
  app.post("/api/auth/register", createRegisterHandler(deps));
  return app;
}

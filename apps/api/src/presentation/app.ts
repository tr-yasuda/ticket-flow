import { Hono } from "hono";

import type { UserRepository } from "../domain/user-repository.js";
import { createLoginHandler } from "./handlers/login-handler.js";
import { createRegisterHandler } from "./handlers/register-handler.js";

export type AuthDependencies = Readonly<{
  userRepository: UserRepository;
  hashPassword: (plainPassword: string) => Promise<string>;
  verifyPassword: (
    plainPassword: string,
    hashedPassword: string,
  ) => Promise<boolean>;
  generateAccessToken: (userId: string) => Promise<string>;
  generateRefreshToken: (userId: string) => Promise<string>;
}>;

export function createApp(deps: AuthDependencies): Hono {
  const app = new Hono();
  app.post("/api/auth/register", createRegisterHandler(deps));
  app.post("/api/auth/login", createLoginHandler(deps));
  return app;
}

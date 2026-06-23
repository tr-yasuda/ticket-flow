import { Hono } from "hono";

import { acceptOrganizationInvitationController } from "../controllers/organization-invitations-controller.js";
import { createRateLimitMiddleware } from "../lib/rate-limiter.js";

const invitationAcceptRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000,
  maxRequests: 50,
  keyGenerator: (c) => `invitation-accept:${c.req.param("token")}`,
  message: "招待の承諾は時間あたりの上限に達しました",
});

export function configureInvitationRoutes(routes: Hono = new Hono()): Hono {
  return routes.post(
    "/:token/accept",
    invitationAcceptRateLimit,
    acceptOrganizationInvitationController,
  );
}

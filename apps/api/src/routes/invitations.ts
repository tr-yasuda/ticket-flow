import { Hono, type Context } from "hono";

import { acceptOrganizationInvitationController } from "../controllers/organization-invitations-controller.js";
import { createRateLimitMiddleware } from "../lib/rate-limiter.js";

function getClientIp(c: Context): string {
  const forwarded = c.req.header("X-Forwarded-For");
  if (forwarded !== undefined && forwarded !== "") {
    return forwarded.split(",")[0].trim();
  }
  const realIp = c.req.header("X-Real-Ip");
  if (realIp !== undefined && realIp !== "") {
    return realIp.trim();
  }
  return "unknown";
}

const invitationAcceptRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000,
  maxRequests: 50,
  keyGenerator: (c) => `invitation-accept:ip:${getClientIp(c)}`,
  message: "招待の承諾は時間あたりの上限に達しました",
});

export function configureInvitationRoutes(routes: Hono = new Hono()): Hono {
  return routes.post(
    "/:token/accept",
    invitationAcceptRateLimit,
    acceptOrganizationInvitationController,
  );
}

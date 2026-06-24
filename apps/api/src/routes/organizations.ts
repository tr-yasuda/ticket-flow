import { sValidator } from "@hono/standard-validator";
import {
  createOrganizationInputSchema,
  createOrganizationInvitationInputSchema,
  updateOrganizationMemberRoleInputSchema,
} from "@ticket-flow/shared";
import { Hono } from "hono";
import { z } from "zod";

import { createRequireRoleMiddleware } from "../controllers/authorization-middleware.js";
import { createOrganizationInvitationController } from "../controllers/organization-invitations-controller.js";
import {
  deleteOrganizationMemberController,
  updateOrganizationMemberRoleController,
} from "../controllers/organization-members-controller.js";
import { organizationScopeMiddleware } from "../controllers/organization-scope-middleware.js";
import {
  createOrganizationController,
  getOrganizationController,
  getOrganizationMembersController,
  getOrganizationsController,
} from "../controllers/organizations-controller.js";
import {
  deleteOrganizationMemberParamsSchema,
  updateOrganizationMemberRoleParamsSchema,
} from "../controllers/schemas/organization-member-schema.js";
import {
  createTicketBodySchema,
  getTicketParamSchema,
  listTicketsQuerySchema,
} from "../controllers/schemas/ticket-schema.js";
import {
  createTicketController,
  getTicketController,
  listTicketsController,
} from "../controllers/tickets-controller.js";
import { createRateLimitMiddleware } from "../lib/rate-limiter.js";
import { validationHook } from "../lib/validation-hook.js";

const listOrganizationMembersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

const requireAdminMiddleware = createRequireRoleMiddleware("admin");
const requireMemberMiddleware = createRequireRoleMiddleware("member");
const requireOwnerMiddleware = createRequireRoleMiddleware("owner");

const invitationRateLimitByOrganization = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000,
  maxRequests: 100,
  keyGenerator: (c) => `org:${c.get("organizationId")}:invitations`,
  message: "この組織での招待作成は時間あたりの上限に達しました",
});

const invitationRateLimitByUser = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000,
  maxRequests: 50,
  keyGenerator: (c) => `user:${c.get("userId")}:invitations`,
  message: "招待作成は時間あたりの上限に達しました",
});

const ticketRateLimitByOrganization = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000,
  maxRequests: 1000,
  keyGenerator: (c) => `org:${c.get("organizationId")}:tickets`,
  message: "この組織でのチケット作成は時間あたりの上限に達しました",
});

const ticketRateLimitByUser = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000,
  maxRequests: 100,
  keyGenerator: (c) => `user:${c.get("userId")}:tickets`,
  message: "チケット作成は時間あたりの上限に達しました",
});

const listTicketsRateLimitByOrganization = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000,
  maxRequests: 3000,
  keyGenerator: (c) => `org:${c.get("organizationId")}:tickets:list`,
  message: "この組織でのチケット一覧取得は時間あたりの上限に達しました",
});

const listTicketsRateLimitByUser = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000,
  maxRequests: 300,
  keyGenerator: (c) => `user:${c.get("userId")}:tickets:list`,
  message: "チケット一覧取得は時間あたりの上限に達しました",
});

const updateMemberRoleRateLimitByOrganization = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000,
  maxRequests: 100,
  keyGenerator: (c) => `org:${c.get("organizationId")}:members:role:update`,
  message: "この組織でのロール変更は時間あたりの上限に達しました",
});

const updateMemberRoleRateLimitByUser = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000,
  maxRequests: 50,
  keyGenerator: (c) => `user:${c.get("userId")}:members:role:update`,
  message: "ロール変更は時間あたりの上限に達しました",
});

const deleteMemberRateLimitByOrganization = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000,
  maxRequests: 100,
  keyGenerator: (c) => `org:${c.get("organizationId")}:members:delete`,
  message: "この組織でのメンバー削除は時間あたりの上限に達しました",
});

const deleteMemberRateLimitByUser = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000,
  maxRequests: 50,
  keyGenerator: (c) => `user:${c.get("userId")}:members:delete`,
  message: "メンバー削除は時間あたりの上限に達しました",
});

export function configureOrganizationRoutes(routes: Hono = new Hono()): Hono {
  return (
    routes
      .get("/", getOrganizationsController)
      .post(
        "/",
        sValidator("json", createOrganizationInputSchema, validationHook),
        createOrganizationController,
      )
      .post(
        "/:organizationId/invitations",
        organizationScopeMiddleware,
        requireAdminMiddleware,
        invitationRateLimitByOrganization,
        invitationRateLimitByUser,
        sValidator(
          "json",
          createOrganizationInvitationInputSchema,
          validationHook,
        ),
        createOrganizationInvitationController,
      )
      .get(
        "/:organizationId/members",
        organizationScopeMiddleware,
        sValidator("query", listOrganizationMembersQuerySchema, validationHook),
        getOrganizationMembersController,
      )
      .patch(
        "/:organizationId/members/:userId/role",
        organizationScopeMiddleware,
        requireOwnerMiddleware,
        updateMemberRoleRateLimitByOrganization,
        updateMemberRoleRateLimitByUser,
        sValidator(
          "param",
          updateOrganizationMemberRoleParamsSchema,
          validationHook,
        ),
        sValidator(
          "json",
          updateOrganizationMemberRoleInputSchema,
          validationHook,
        ),
        updateOrganizationMemberRoleController,
      )
      // Owner/Admin がメンバーを削除できる。
      // Admin は Member/Viewer のみ、Owner はすべてのロールを削除できる。
      .delete(
        "/:organizationId/members/:userId",
        organizationScopeMiddleware,
        requireAdminMiddleware,
        sValidator(
          "param",
          deleteOrganizationMemberParamsSchema,
          validationHook,
        ),
        deleteMemberRateLimitByOrganization,
        deleteMemberRateLimitByUser,
        deleteOrganizationMemberController,
      )
      .get(
        "/:organizationId/tickets",
        organizationScopeMiddleware,
        listTicketsRateLimitByOrganization,
        listTicketsRateLimitByUser,
        sValidator("query", listTicketsQuerySchema, validationHook),
        listTicketsController,
      )
      .post(
        "/:organizationId/tickets",
        organizationScopeMiddleware,
        requireMemberMiddleware,
        ticketRateLimitByOrganization,
        ticketRateLimitByUser,
        sValidator("json", createTicketBodySchema, validationHook),
        createTicketController,
      )
      .get(
        "/:organizationId/tickets/:ticketId",
        organizationScopeMiddleware,
        sValidator("param", getTicketParamSchema, validationHook),
        getTicketController,
      )
      .get(
        "/:organizationId",
        organizationScopeMiddleware,
        getOrganizationController,
      )
  );
}

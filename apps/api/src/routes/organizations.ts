import { sValidator } from "@hono/standard-validator";
import {
  createOrganizationInputSchema,
  createOrganizationInvitationInputSchema,
  updateOrganizationMemberRoleInputSchema,
} from "@ticket-flow/shared";
import { Hono } from "hono";
import { z } from "zod";

import { createRequireRoleMiddleware } from "../controllers/authorization-middleware.js";
import {
  createCommentController,
  listCommentsController,
} from "../controllers/comments-controller.js";
import { getOrganizationDashboardController } from "../controllers/dashboard-controller.js";
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
  createCommentBodySchema,
  listCommentsQuerySchema,
} from "../controllers/schemas/comment-schema.js";
import {
  deleteOrganizationMemberParamsSchema,
  updateOrganizationMemberRoleParamsSchema,
} from "../controllers/schemas/organization-member-schema.js";
import {
  createTicketBodySchema,
  listTicketsQuerySchema,
  ticketIdParamSchema,
  updateTicketAssigneeBodySchema,
  updateTicketBodySchema,
  updateTicketPriorityBodySchema,
  updateTicketStatusBodySchema,
} from "../controllers/schemas/ticket-schema.js";
import {
  createTicketController,
  deleteTicketController,
  getTicketController,
  listTicketsController,
  updateTicketAssigneeController,
  updateTicketController,
  updateTicketPriorityController,
  updateTicketStatusController,
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

const updateTicketRateLimitByOrganization = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000,
  maxRequests: 1000,
  keyGenerator: (c) => `org:${c.get("organizationId")}:tickets:update`,
  message: "この組織でのチケット更新は時間あたりの上限に達しました",
});

const updateTicketRateLimitByUser = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000,
  maxRequests: 100,
  keyGenerator: (c) => `user:${c.get("userId")}:tickets:update`,
  message: "チケット更新は時間あたりの上限に達しました",
});

const updateTicketStatusRateLimitByOrganization = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000,
  maxRequests: 1000,
  keyGenerator: (c) => `org:${c.get("organizationId")}:tickets:status:update`,
  message: "この組織でのステータス更新は時間あたりの上限に達しました",
});

const updateTicketStatusRateLimitByUser = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000,
  maxRequests: 100,
  keyGenerator: (c) => `user:${c.get("userId")}:tickets:status:update`,
  message: "ステータス更新は時間あたりの上限に達しました",
});

const updateTicketPriorityRateLimitByOrganization = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000,
  maxRequests: 1000,
  keyGenerator: (c) => `org:${c.get("organizationId")}:tickets:priority:update`,
  message: "この組織での優先度更新は時間あたりの上限に達しました",
});

const updateTicketPriorityRateLimitByUser = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000,
  maxRequests: 100,
  keyGenerator: (c) => `user:${c.get("userId")}:tickets:priority:update`,
  message: "優先度更新は時間あたりの上限に達しました",
});

const updateTicketAssigneeRateLimitByOrganization = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000,
  maxRequests: 1000,
  keyGenerator: (c) =>
    `org:${c.req.param("organizationId")}:tickets:assignee:update`,
  message: "この組織での担当者更新は時間あたりの上限に達しました",
});

const updateTicketAssigneeRateLimitByUser = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000,
  maxRequests: 100,
  keyGenerator: (c) => `user:${c.get("userId")}:tickets:assignee:update`,
  message: "担当者更新は時間あたりの上限に達しました",
});

const deleteTicketRateLimitByOrganization = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000,
  maxRequests: 100,
  keyGenerator: (c) => `org:${c.get("organizationId")}:tickets:delete`,
  message: "この組織でのチケット削除は時間あたりの上限に達しました",
});

const deleteTicketRateLimitByUser = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000,
  maxRequests: 50,
  keyGenerator: (c) => `user:${c.get("userId")}:tickets:delete`,
  message: "チケット削除は時間あたりの上限に達しました",
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

const listCommentsRateLimitByOrganization = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000,
  maxRequests: 3000,
  keyGenerator: (c) => `org:${c.get("organizationId")}:comments:list`,
  message: "この組織でのコメント一覧取得は時間あたりの上限に達しました",
});

const listCommentsRateLimitByUser = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000,
  maxRequests: 300,
  keyGenerator: (c) => `user:${c.get("userId")}:comments:list`,
  message: "コメント一覧取得は時間あたりの上限に達しました",
});

const createCommentRateLimitByOrganization = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000,
  maxRequests: 1000,
  keyGenerator: (c) => `org:${c.get("organizationId")}:comments:create`,
  message: "この組織でのコメント投稿は時間あたりの上限に達しました",
});

const createCommentRateLimitByUser = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000,
  maxRequests: 100,
  keyGenerator: (c) => `user:${c.get("userId")}:comments:create`,
  message: "コメント投稿は時間あたりの上限に達しました",
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

const dashboardRateLimitByOrganization = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000,
  maxRequests: 3000,
  keyGenerator: (c) => `org:${c.get("organizationId")}:dashboard`,
  message: "この組織でのダッシュボード取得は時間あたりの上限に達しました",
});

const dashboardRateLimitByUser = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000,
  maxRequests: 300,
  keyGenerator: (c) => `user:${c.get("userId")}:dashboard`,
  message: "ダッシュボード取得は時間あたりの上限に達しました",
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
        updateMemberRoleRateLimitByOrganization,
        updateMemberRoleRateLimitByUser,
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
        "/:organizationId/tickets/:ticketId/comments",
        organizationScopeMiddleware,
        listCommentsRateLimitByOrganization,
        listCommentsRateLimitByUser,
        sValidator("param", ticketIdParamSchema, validationHook),
        sValidator("query", listCommentsQuerySchema, validationHook),
        listCommentsController,
      )
      .post(
        "/:organizationId/tickets/:ticketId/comments",
        organizationScopeMiddleware,
        requireMemberMiddleware,
        createCommentRateLimitByOrganization,
        createCommentRateLimitByUser,
        sValidator("param", ticketIdParamSchema, validationHook),
        sValidator("json", createCommentBodySchema, validationHook),
        createCommentController,
      )
      .get(
        "/:organizationId/tickets/:ticketId",
        organizationScopeMiddleware,
        sValidator("param", ticketIdParamSchema, validationHook),
        getTicketController,
      )
      .patch(
        "/:organizationId/tickets/:ticketId",
        organizationScopeMiddleware,
        requireMemberMiddleware,
        updateTicketRateLimitByOrganization,
        updateTicketRateLimitByUser,
        sValidator("param", ticketIdParamSchema, validationHook),
        sValidator("json", updateTicketBodySchema, validationHook),
        updateTicketController,
      )
      .patch(
        "/:organizationId/tickets/:ticketId/status",
        organizationScopeMiddleware,
        requireMemberMiddleware,
        updateTicketStatusRateLimitByOrganization,
        updateTicketStatusRateLimitByUser,
        sValidator("param", ticketIdParamSchema, validationHook),
        sValidator("json", updateTicketStatusBodySchema, validationHook),
        updateTicketStatusController,
      )
      .patch(
        "/:organizationId/tickets/:ticketId/priority",
        organizationScopeMiddleware,
        requireMemberMiddleware,
        updateTicketPriorityRateLimitByOrganization,
        updateTicketPriorityRateLimitByUser,
        sValidator("param", ticketIdParamSchema, validationHook),
        sValidator("json", updateTicketPriorityBodySchema, validationHook),
        updateTicketPriorityController,
      )
      .patch(
        "/:organizationId/tickets/:ticketId/assignee",
        updateTicketAssigneeRateLimitByOrganization,
        updateTicketAssigneeRateLimitByUser,
        organizationScopeMiddleware,
        requireMemberMiddleware,
        sValidator("param", ticketIdParamSchema, validationHook),
        sValidator("json", updateTicketAssigneeBodySchema, validationHook),
        updateTicketAssigneeController,
      )
      .delete(
        "/:organizationId/tickets/:ticketId",
        organizationScopeMiddleware,
        requireAdminMiddleware,
        deleteTicketRateLimitByOrganization,
        deleteTicketRateLimitByUser,
        sValidator("param", ticketIdParamSchema, validationHook),
        deleteTicketController,
      )
      .get(
        "/:organizationId/dashboard",
        organizationScopeMiddleware,
        dashboardRateLimitByOrganization,
        dashboardRateLimitByUser,
        getOrganizationDashboardController,
      )
      .get(
        "/:organizationId",
        organizationScopeMiddleware,
        getOrganizationController,
      )
  );
}

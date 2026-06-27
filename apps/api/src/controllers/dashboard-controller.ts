import {
  ApiErrorCode,
  createApiErrorResponse,
  createApiSuccessResponse,
} from "@ticket-flow/shared";
import type { Context } from "hono";

import { HttpStatus } from "../lib/http-status.js";
import { getOrganizationDashboard } from "../services/dashboard-service.js";
import type { OrganizationDashboard } from "../services/dashboard-service.js";
import { getRequiredContextValue } from "./context-helpers.js";

export async function getOrganizationDashboardController(c: Context) {
  const organizationId = getRequiredContextValue(c, "organizationId");
  const userId = getRequiredContextValue(c, "userId");

  const result = await getOrganizationDashboard({
    organizationId,
    userId,
  });

  if (!result.success) {
    const statusCode =
      result.error.type === "NOT_MEMBER"
        ? HttpStatus.FORBIDDEN
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const errorCode =
      result.error.type === "NOT_MEMBER"
        ? ApiErrorCode.AUTH_FORBIDDEN
        : ApiErrorCode.INTERNAL_ERROR;

    return c.json(
      createApiErrorResponse(errorCode, result.error.message),
      statusCode,
    );
  }

  return c.json(
    createApiSuccessResponse(toDashboardResponse(result.data)),
    HttpStatus.OK,
  );
}

function toDashboardResponse(dashboard: OrganizationDashboard): Omit<
  OrganizationDashboard,
  "recentActivity"
> & {
  recentActivity: Array<
    Omit<OrganizationDashboard["recentActivity"][number], "createdAt"> & {
      createdAt: string;
    }
  >;
} {
  return {
    ...dashboard,
    recentActivity: dashboard.recentActivity.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    })),
  };
}

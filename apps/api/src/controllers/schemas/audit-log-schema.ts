import { z } from "zod";

import { MAX_SKIP } from "../../infrastructure/database/pagination.js";

export const listOrganizationAuditLogsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine((data) => (data.page - 1) * data.perPage <= MAX_SKIP, {
    message: "ページ範囲が大きすぎます",
    path: ["page"],
  });

export type ListOrganizationAuditLogsQuery = z.infer<
  typeof listOrganizationAuditLogsQuerySchema
>;

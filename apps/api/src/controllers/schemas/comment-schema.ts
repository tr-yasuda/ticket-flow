import { commentContentSchema } from "@ticket-flow/shared";
import { z } from "zod";

export const createCommentBodySchema = z.object({
  content: commentContentSchema,
});

export type CreateCommentBody = z.infer<typeof createCommentBodySchema>;

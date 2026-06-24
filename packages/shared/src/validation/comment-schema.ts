import { z } from "zod";

const MAX_COMMENT_CONTENT_LENGTH = 10000;
const MAX_ID_LENGTH = 200;

function trim(value: string): string {
  return value.trim();
}

function createNonEmptyIdSchema(fieldName: string, message: string) {
  return z
    .string({ message })
    .min(1, message)
    .max(MAX_ID_LENGTH, {
      message: `${fieldName}は${MAX_ID_LENGTH}文字以内で入力してください`,
    })
    .transform(trim)
    .refine((value) => value.length > 0, message);
}

/**
 * コメント本文のスキーマ。
 *
 * content はプレーンテキストとして扱われ、レンダリング時に HTML エスケープが必要。
 * マークダウンやリッチテキストを解釈する場合は、別途サニタイズ方針を決定すること。
 */
export const commentContentSchema = z
  .string({ message: "コメントを入力してください" })
  .min(1, "コメントを入力してください")
  .transform(trim)
  .refine((value) => value.length > 0, "コメントを入力してください")
  .refine(
    (value) => value.length <= MAX_COMMENT_CONTENT_LENGTH,
    `コメントは${MAX_COMMENT_CONTENT_LENGTH}文字以内で入力してください`,
  );

export const commentTicketIdSchema = createNonEmptyIdSchema(
  "ticketId",
  "チケットIDを入力してください",
);

export const commentOrganizationIdSchema = createNonEmptyIdSchema(
  "organizationId",
  "組織IDを入力してください",
);

export const commentAuthorIdSchema = createNonEmptyIdSchema(
  "authorId",
  "作成者IDを入力してください",
);

export const createCommentInputSchema = z.object({
  ticketId: commentTicketIdSchema,
  organizationId: commentOrganizationIdSchema,
  authorId: commentAuthorIdSchema,
  content: commentContentSchema,
});

export type CreateCommentInput = z.infer<typeof createCommentInputSchema>;

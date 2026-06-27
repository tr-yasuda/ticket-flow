/**
 * コメントの作者情報。
 *
 * `name` は optional なため null の場合があり、表示用の name は
 * `author.name ?? author.email` でフォールバックして扱う。
 */
export type CommentAuthor = Readonly<{
  id: string;
  name: string | null;
  email: string;
}>;

/**
 * 作者情報を含むコメント。
 *
 * コメント作成・一覧 API のレスポンスで使用する。
 * 日付は JSON シリアライズ後の ISO 8601 文字列として扱う。
 */
export type CommentWithAuthor = Readonly<{
  id: string;
  ticketId: string;
  organizationId: string;
  content: string;
  author: CommentAuthor;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
}>;

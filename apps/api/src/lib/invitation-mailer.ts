export type SendInvitationEmailInput = Readonly<{
  email: string;
  organizationId: string;
  token: string;
}>;

/**
 * 招待メールを送信する。
 *
 * 現時点では本番メール送信設定を持たないため、スタブとして即座に resolve する。
 * トークンやメールアドレスなどの機微情報はログに出力しない。
 */
export async function sendInvitationEmail(
  _input: SendInvitationEmailInput,
): Promise<void> {
  // TODO: 本番環境では SendGrid / Amazon SES 等のメール送信サービスに差し替える
}

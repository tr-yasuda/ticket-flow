import { createHash } from "node:crypto";

export type RefreshToken = Readonly<{
  tokenHash: string;
  userId: string;
}>;

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

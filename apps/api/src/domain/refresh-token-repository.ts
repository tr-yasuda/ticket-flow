import type { RefreshToken } from "./refresh-token.js";
import type { Repository } from "./repository.js";

export type RefreshTokenRepository = Repository<RefreshToken, string> &
  Readonly<{
    findByTokenHash(tokenHash: string): Promise<RefreshToken | null>;
  }>;

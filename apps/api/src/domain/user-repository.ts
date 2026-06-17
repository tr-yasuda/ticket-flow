import type { Repository } from "./repository.js";
import type { User, UserId } from "./user.js";

export type UserRepository = Repository<User, UserId> &
  Readonly<{
    findByEmail(email: string): Promise<User | null>;
  }>;

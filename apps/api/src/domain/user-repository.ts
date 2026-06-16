import type { Repository } from "./repository.js";
import type { User } from "./user.js";

export type UserRepository = Repository<User, string> &
  Readonly<{
    findByEmail(email: string): Promise<User | null>;
  }>;

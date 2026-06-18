import { type PrismaClient } from "@prisma/client";

import { prisma } from "../lib/prisma.js";

export type GetCurrentUserInput = Readonly<{
  userId: string;
}>;

export type GetCurrentUserResult =
  | { success: true; data: { user: { id: string; email: string } } }
  | { success: false; error: { type: "user-not-found" } };

export async function getCurrentUser(
  input: GetCurrentUserInput,
  db: PrismaClient = prisma,
): Promise<GetCurrentUserResult> {
  const user = await db.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true },
  });

  if (user === null) {
    return {
      success: false,
      error: { type: "user-not-found" },
    };
  }

  return {
    success: true,
    data: {
      user,
    },
  };
}

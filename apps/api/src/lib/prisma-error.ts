import { Prisma } from "@prisma/client";

export function isUniqueConstraintTarget(
  error: Prisma.PrismaClientKnownRequestError,
  field: string,
): boolean {
  if (error.code !== "P2002" || error.meta === undefined) {
    return false;
  }
  const target = error.meta.target;
  if (Array.isArray(target)) {
    return target.includes(field);
  }
  return target === field;
}

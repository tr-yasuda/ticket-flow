import { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

describe("Prisma Client", () => {
  it("apps/api から PrismaClient 型を import できる", () => {
    expect(typeof PrismaClient).toBe("function");
  });
});

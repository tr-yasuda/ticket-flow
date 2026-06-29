import { describe, expect, it, vi } from "vitest";

import { UserNotOrganizationMemberError } from "../../../src/domain/organization-member.js";
import {
  assertUserIsOrganizationMember,
  isUserOrganizationMember,
} from "../../../src/lib/membership-assertions.js";

describe("membership-assertions", () => {
  describe("isUserOrganizationMember", () => {
    it("メンバーが存在する場合は true を返す", async () => {
      const db = {
        organizationMember: {
          findUnique: vi.fn().mockResolvedValue({ id: "member-id" }),
        },
      };

      const result = await isUserOrganizationMember(
        db as never,
        "org-id",
        "user-id",
      );

      expect(result).toBe(true);
      expect(db.organizationMember.findUnique).toHaveBeenCalledWith({
        where: {
          organizationId_userId: {
            organizationId: "org-id",
            userId: "user-id",
          },
        },
      });
    });

    it("大文字の userId は小文字化してクエリする", async () => {
      const db = {
        organizationMember: {
          findUnique: vi.fn().mockResolvedValue({ id: "member-id" }),
        },
      };

      const result = await isUserOrganizationMember(
        db as never,
        "org-id",
        "USER-ID",
      );

      expect(result).toBe(true);
      expect(db.organizationMember.findUnique).toHaveBeenCalledWith({
        where: {
          organizationId_userId: {
            organizationId: "org-id",
            userId: "user-id",
          },
        },
      });
    });

    it("メンバーが存在しない場合は false を返す", async () => {
      const db = {
        organizationMember: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      };

      const result = await isUserOrganizationMember(
        db as never,
        "org-id",
        "user-id",
      );

      expect(result).toBe(false);
    });
  });

  describe("assertUserIsOrganizationMember", () => {
    it("メンバーの場合はエラーを投げない", async () => {
      const db = {
        organizationMember: {
          findUnique: vi.fn().mockResolvedValue({ id: "member-id" }),
        },
      };

      await expect(
        assertUserIsOrganizationMember(db as never, "org-id", "user-id"),
      ).resolves.toBeUndefined();
    });

    it("メンバーでない場合は UserNotOrganizationMemberError を投げる", async () => {
      const db = {
        organizationMember: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      };

      await expect(
        assertUserIsOrganizationMember(db as never, "org-id", "user-id"),
      ).rejects.toThrow(UserNotOrganizationMemberError);
    });
  });
});

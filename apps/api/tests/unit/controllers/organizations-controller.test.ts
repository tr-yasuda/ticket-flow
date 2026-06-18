import type { Context } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createOrganizationController,
  getOrganizationsController,
} from "../../../src/controllers/organizations-controller.js";
import * as organizationsService from "../../../src/services/organizations-service.js";

function createTestContext({
  body,
  userId,
}: {
  body?: unknown;
  userId?: string;
} = {}): Context {
  const json = vi.fn();
  const c = {
    req: {
      valid: vi.fn().mockReturnValue(body),
      header: vi.fn().mockReturnValue(undefined),
    },
    json,
    body: vi.fn(),
    get: vi.fn().mockImplementation((key: string) => {
      if (key === "userId") {
        return userId;
      }
      return undefined;
    }),
  } as unknown as Context;
  return c;
}

describe("organizations-controller", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("組織作成成功時に 201 を返す", async () => {
    vi.spyOn(organizationsService, "createOrganization").mockResolvedValue({
      success: true,
      data: { id: "org-id", name: "Acme Inc.", slug: "acme-inc" },
    });
    const c = createTestContext({
      body: { name: "Acme Inc.", slug: "acme-inc" },
      userId: "user-id",
    });

    await createOrganizationController(c);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: { id: "org-id", name: "Acme Inc.", slug: "acme-inc" },
      }),
      201,
    );
  });

  it("未認証時に 401 を返す", async () => {
    const c = createTestContext({
      body: { name: "Acme Inc.", slug: "acme-inc" },
    });

    await createOrganizationController(c);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
      401,
    );
  });

  it("スラッグ重複時に 409 を返す", async () => {
    vi.spyOn(organizationsService, "createOrganization").mockResolvedValue({
      success: false,
      error: { type: "slug-already-exists", message: "Slug already exists" },
    });
    const c = createTestContext({
      body: { name: "Acme Inc.", slug: "acme-inc" },
      userId: "user-id",
    });

    await createOrganizationController(c);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "CONFLICT" }),
      }),
      409,
    );
  });

  it("認証済みユーザーが所属組織一覧を取得できる", async () => {
    const getOrganizationsByUserIdSpy = vi
      .spyOn(organizationsService, "getOrganizationsByUserId")
      .mockResolvedValue({
        success: true,
        data: {
          organizations: [
            {
              id: "org-1",
              name: "Acme Inc.",
              slug: "acme-inc",
              role: "owner",
            },
          ],
        },
      });
    const c = createTestContext({ userId: "user-id" });

    await getOrganizationsController(c);

    expect(getOrganizationsByUserIdSpy).toHaveBeenCalledWith({
      userId: "user-id",
    });
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: {
          organizations: [
            {
              id: "org-1",
              name: "Acme Inc.",
              slug: "acme-inc",
              role: "owner",
            },
          ],
        },
      }),
      200,
    );
  });

  it("所属組織がない場合は空配列を返す", async () => {
    const getOrganizationsByUserIdSpy = vi
      .spyOn(organizationsService, "getOrganizationsByUserId")
      .mockResolvedValue({
        success: true,
        data: { organizations: [] },
      });
    const c = createTestContext({ userId: "user-id" });

    await getOrganizationsController(c);

    expect(getOrganizationsByUserIdSpy).toHaveBeenCalledWith({
      userId: "user-id",
    });
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: { organizations: [] },
      }),
      200,
    );
  });
});

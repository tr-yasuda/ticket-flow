import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createOrganization, getOrganizations } from "@/lib/organizations-api";
import { clearTokens, setTokens } from "@/lib/token-storage";
import { server } from "@/mocks/server.js";

beforeEach(() => {
  setTokens("mock-access-token", "mock-refresh-token");
});

afterEach(() => {
  clearTokens();
});

const validOrganization = {
  id: "demo-org-001",
  name: "Demo Organization",
  slug: "demo-organization",
  role: "owner",
};

describe("organizations-api", () => {
  it("組織一覧を取得できる", async () => {
    const data = await getOrganizations();

    expect(data.organizations).toHaveLength(1);
    expect(data.organizations[0]).toMatchObject({
      id: "demo-org-001",
      name: "Demo Organization",
      slug: "demo-organization",
      role: "owner",
    });
  });

  it("組織を作成できる", async () => {
    const organization = await createOrganization({
      name: "New Org",
      slug: "new-org",
    });

    expect(organization).toMatchObject({
      id: "mock-new-org-id",
      name: "New Org",
      slug: "new-org",
    });
  });

  it("ラップなしレスポンスはエラー", async () => {
    server.use(
      http.get("/api/organizations", () =>
        HttpResponse.json(
          { organizations: [validOrganization] },
          { status: 200 },
        ),
      ),
    );

    await expect(getOrganizations()).rejects.toThrow(
      "Invalid response: invalid envelope",
    );
  });

  it("不正な organization 要素を含むレスポンスはエラー", async () => {
    server.use(
      http.get("/api/organizations", () =>
        HttpResponse.json(
          { success: true, data: { organizations: [{ id: "invalid" }] } },
          { status: 200 },
        ),
      ),
    );

    await expect(getOrganizations()).rejects.toThrow(
      "Invalid organizations response",
    );
  });
});

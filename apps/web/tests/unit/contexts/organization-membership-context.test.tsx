import { renderHook, waitFor } from "@testing-library/react";
import { createApiSuccessResponse } from "@ticket-flow/shared";
import { http, HttpResponse } from "msw";
import { act } from "react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { AuthProvider } from "@/contexts/auth-context";
import {
  OrganizationMembershipProvider,
  useOrganizationMembership,
} from "@/contexts/organization-membership-context";
import { clearTokens, setTokens } from "@/lib/token-storage";
import { server } from "@/mocks/server.js";

function wrapper({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <OrganizationMembershipProvider>
        {children}
      </OrganizationMembershipProvider>
    </AuthProvider>
  );
}

describe("OrganizationMembershipProvider", () => {
  beforeEach(() => {
    clearTokens();
  });

  it("未認証時は organizations が空で hasOrganization が false", async () => {
    const { result } = renderHook(() => useOrganizationMembership(), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.organizations).toEqual([]);
    expect(result.current.hasOrganization).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("認証済み時に組織一覧を取得する", async () => {
    setTokens("mock-access-token", "mock-refresh-token");

    const { result } = renderHook(() => useOrganizationMembership(), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.organizations).toHaveLength(1);
    expect(result.current.hasOrganization).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("組織未所属の場合 hasOrganization が false", async () => {
    setTokens("mock-access-token", "mock-refresh-token");
    server.use(
      http.get("/api/organizations", () => {
        return HttpResponse.json(
          createApiSuccessResponse({ organizations: [] }),
          { status: 200 },
        );
      }),
    );

    const { result } = renderHook(() => useOrganizationMembership(), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.organizations).toEqual([]);
    expect(result.current.hasOrganization).toBe(false);
  });

  it("組織取得に失敗した場合 error 状態になる", async () => {
    setTokens("mock-access-token", "mock-refresh-token");
    server.use(
      http.get("/api/organizations", () => {
        return new HttpResponse(null, { status: 500 });
      }),
    );

    const { result } = renderHook(() => useOrganizationMembership(), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.hasOrganization).toBe(false);
    expect(result.current.organizations).toEqual([]);
  });

  it("refetch で組織一覧を更新する", async () => {
    setTokens("mock-access-token", "mock-refresh-token");
    server.use(
      http.get("/api/organizations", () => {
        return HttpResponse.json(
          createApiSuccessResponse({ organizations: [] }),
          { status: 200 },
        );
      }),
    );

    const { result } = renderHook(() => useOrganizationMembership(), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.organizations).toEqual([]);
    expect(result.current.hasOrganization).toBe(false);

    server.resetHandlers();

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.organizations).toHaveLength(1);
    });
    expect(result.current.hasOrganization).toBe(true);
  });
});

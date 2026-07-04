import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { clearTokens, setTokens } from "@/lib/token-storage";

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

vi.mock("@/lib/auth-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auth-api")>();
  return {
    ...original,
    logout: vi.fn().mockResolvedValue(undefined),
    getCurrentUser: vi.fn().mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      name: null,
    }),
  };
});

describe("AuthProvider", () => {
  beforeEach(() => {
    clearTokens();
  });

  it("外部で clearTokens された場合、isAuthenticated が false になる", async () => {
    setTokens("mock-access-token", "mock-refresh-token");

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    act(() => {
      clearTokens();
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  it("logout 時にトークンをクリアし unauthenticated になる", async () => {
    setTokens("mock-access-token", "mock-refresh-token");

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
  });
});

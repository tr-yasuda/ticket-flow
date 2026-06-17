import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactElement, ReactNode } from "react";

import {
  getCurrentUser,
  logout as logoutApi,
  type AuthResponse,
  type CurrentUser,
} from "@/lib/auth-api";
import { clearTokens, getAccessToken, setTokens } from "@/lib/token-storage";

type AuthState =
  | { type: "loading" }
  | { type: "authenticated"; user: CurrentUser }
  | { type: "unauthenticated" };

export type AuthContextValue = Readonly<{
  user: CurrentUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: Error | null;
  login: (response: AuthResponse) => void;
  logout: () => Promise<void>;
}>;

const AuthContext = createContext<AuthContextValue | null>(null);

function getInitialAuthState(): AuthState {
  return getAccessToken() === null
    ? { type: "unauthenticated" }
    : { type: "loading" };
}

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const [state, setState] = useState<AuthState>(getInitialAuthState);
  const [error, setError] = useState<Error | null>(null);
  const didInitialize = useRef(false);

  const initialize = useCallback(async () => {
    const token = getAccessToken();
    if (token === null) {
      setState({ type: "unauthenticated" });
      return;
    }

    try {
      const user = await getCurrentUser();
      setState({ type: "authenticated", user });
    } catch (caughtError) {
      clearTokens();
      setState({ type: "unauthenticated" });
      setError(
        caughtError instanceof Error
          ? caughtError
          : new Error("Failed to fetch current user"),
      );
    }
  }, []);

  useEffect(() => {
    if (didInitialize.current) {
      return;
    }
    didInitialize.current = true;

    void initialize();
  }, [initialize]);

  const login = useCallback((response: AuthResponse) => {
    setTokens(response.accessToken, response.refreshToken);
    setError(null);
    setState({ type: "authenticated", user: response.user });
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError
          : new Error("Failed to logout"),
      );
    } finally {
      clearTokens();
      setState({ type: "unauthenticated" });
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const accessToken = getAccessToken();
    const isAuthenticated =
      state.type === "authenticated" && accessToken !== null;
    const user = isAuthenticated ? state.user : null;

    return {
      user,
      isLoading: state.type === "loading",
      isAuthenticated,
      error,
      login,
      logout,
    };
  }, [state, error, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function useCurrentUser(): CurrentUser | null {
  return useAuth().user;
}

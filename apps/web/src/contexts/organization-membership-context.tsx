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

import { getOrganizations, type Organization } from "@/lib/organizations-api";

import { useAuth } from "./auth-context";

type OrganizationMembershipState =
  | { type: "loading" }
  | {
      type: "ready";
      organizations: readonly Organization[];
    }
  | { type: "error"; error: Error };

export type OrganizationMembershipContextValue = Readonly<{
  organizations: readonly Organization[];
  isLoading: boolean;
  error: Error | null;
  hasOrganization: boolean;
  refetch: () => Promise<void>;
}>;

const OrganizationMembershipContext =
  createContext<OrganizationMembershipContextValue | null>(null);

export function OrganizationMembershipProvider({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [state, setState] = useState<OrganizationMembershipState>({
    type: "loading",
  });
  const requestIdRef = useRef(0);

  const fetchOrganizations = useCallback(async () => {
    if (!isAuthenticated) {
      requestIdRef.current += 1;
      setState({ type: "ready", organizations: [] });
      return;
    }

    const requestId = ++requestIdRef.current;
    setState({ type: "loading" });
    try {
      const data = await getOrganizations();
      if (requestId !== requestIdRef.current) {
        return;
      }
      setState({ type: "ready", organizations: data.organizations });
    } catch (caughtError) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setState({
        type: "error",
        error:
          caughtError instanceof Error
            ? caughtError
            : new Error("Failed to fetch organizations"),
      });
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    void fetchOrganizations();
  }, [isAuthLoading, isAuthenticated, fetchOrganizations]);

  const value = useMemo<OrganizationMembershipContextValue>(() => {
    switch (state.type) {
      case "ready":
        return {
          organizations: state.organizations,
          isLoading: false,
          error: null,
          hasOrganization: state.organizations.length > 0,
          refetch: fetchOrganizations,
        };
      case "error":
        return {
          organizations: [],
          isLoading: false,
          error: state.error,
          hasOrganization: false,
          refetch: fetchOrganizations,
        };
      case "loading":
      default:
        return {
          organizations: [],
          isLoading: true,
          error: null,
          hasOrganization: false,
          refetch: fetchOrganizations,
        };
    }
  }, [state, fetchOrganizations]);

  return (
    <OrganizationMembershipContext.Provider value={value}>
      {children}
    </OrganizationMembershipContext.Provider>
  );
}

export function useOrganizationMembership(): OrganizationMembershipContextValue {
  const context = useContext(OrganizationMembershipContext);
  if (context === null) {
    throw new Error(
      "useOrganizationMembership must be used within an OrganizationMembershipProvider",
    );
  }
  return context;
}

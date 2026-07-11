import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  getOrganizationMembers,
  type ListOrganizationMembersInput,
  type OrganizationMemberListItem,
} from "@/lib/organization-members-api";

export type UseOrganizationMembersInput = Omit<
  ListOrganizationMembersInput,
  "signal"
> &
  Readonly<{
    enabled?: boolean;
  }>;

export type UseOrganizationMembersResult = Readonly<{
  members: readonly OrganizationMemberListItem[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}>;

const emptyMembers: readonly OrganizationMemberListItem[] = [];

export function useOrganizationMembers(
  input: UseOrganizationMembersInput,
): UseOrganizationMembersResult {
  const { organizationId, enabled = true } = input;

  const [members, setMembers] =
    useState<readonly OrganizationMemberListItem[]>(emptyMembers);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      setError(null);
      setMembers(emptyMembers);
      return;
    }

    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    void getOrganizationMembers({
      organizationId,
      signal: controller.signal,
    })
      .then((result) => {
        if (!mountedRef.current || controller.signal.aborted) {
          return;
        }
        setMembers(result.members);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (!mountedRef.current || controller.signal.aborted) {
          return;
        }
        setMembers(emptyMembers);
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [enabled, organizationId, retryKey]);

  const refetch = useCallback(() => {
    setRetryKey((previous) => previous + 1);
  }, []);

  return useMemo(
    () => ({
      members,
      isLoading,
      error,
      refetch,
    }),
    [members, isLoading, error, refetch],
  );
}

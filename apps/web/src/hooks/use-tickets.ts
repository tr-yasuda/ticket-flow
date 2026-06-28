import { useCallback, useEffect, useMemo, useState } from "react";

import {
  listTickets,
  type ListTicketsInput,
  type ListTicketsResult,
  type TicketListItem,
} from "@/lib/tickets-api";

export type UseTicketsInput = ListTicketsInput &
  Readonly<{
    enabled?: boolean;
  }>;

export type UseTicketsResult = Readonly<{
  tickets: readonly TicketListItem[];
  isLoading: boolean;
  error: Error | null;
  currentPage: number;
  totalPages: number;
  refetch: () => void;
}>;

const emptyTickets: readonly TicketListItem[] = [];

export function useTickets(input: UseTicketsInput): UseTicketsResult {
  const { organizationId, page = 1, perPage = 20, enabled = true } = input;

  const [result, setResult] = useState<ListTicketsResult | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      setError(null);
      setResult(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    setIsLoading(true);
    setError(null);
    setResult(null);

    void listTickets({
      organizationId,
      page,
      perPage,
      signal: controller.signal,
    })
      .then((data) => {
        if (cancelled) {
          return;
        }
        setResult(data);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        setResult(null);
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled, organizationId, page, perPage, retryKey]);

  const refetch = useCallback(() => {
    setRetryKey((previous) => previous + 1);
  }, []);

  return useMemo(
    () => ({
      tickets: result?.tickets ?? emptyTickets,
      isLoading,
      error,
      currentPage: result?.page ?? page,
      totalPages: result?.totalPages ?? 1,
      refetch,
    }),
    [result, isLoading, error, page, refetch],
  );
}

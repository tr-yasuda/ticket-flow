import { useCallback, useEffect, useMemo, useState } from "react";

import {
  listTickets,
  type ListTicketsInput,
  type ListTicketsResult,
  type TicketListItem,
} from "@/lib/tickets-api";

export type UseTicketsInput = Omit<ListTicketsInput, "signal"> &
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

type ResultEntry = Readonly<{
  key: string;
  data: ListTicketsResult;
}>;

const emptyTickets: readonly TicketListItem[] = [];

function createRequestKey(
  organizationId: string,
  page: number,
  perPage: number,
  retryKey: number,
): string {
  return `${organizationId}:${page}:${perPage}:${retryKey}`;
}

export function useTickets(input: UseTicketsInput): UseTicketsResult {
  const { organizationId, page = 1, perPage = 20, enabled = true } = input;

  const [result, setResult] = useState<ResultEntry | null>(null);
  const [isFetching, setIsFetching] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const requestKey = useMemo(
    () => createRequestKey(organizationId, page, perPage, retryKey),
    [organizationId, page, perPage, retryKey],
  );

  useEffect(() => {
    if (!enabled) {
      setIsFetching(false);
      setError(null);
      setResult(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    setIsFetching(true);
    setError(null);

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
        setResult({ key: requestKey, data });
        setIsFetching(false);
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        setResult(null);
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsFetching(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled, requestKey, organizationId, page, perPage]);

  const refetch = useCallback(() => {
    setRetryKey((previous) => previous + 1);
  }, []);

  const isStale = result === null || result.key !== requestKey;
  const currentResult = isStale ? null : result.data;

  return useMemo(
    () => ({
      tickets: currentResult?.tickets ?? emptyTickets,
      isLoading: enabled && (isFetching || isStale) && error === null,
      error,
      currentPage: currentResult?.page ?? page,
      totalPages: currentResult?.totalPages ?? 1,
      refetch,
    }),
    [currentResult, enabled, isFetching, isStale, error, page, refetch],
  );
}

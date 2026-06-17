import { useCallback, useRef, useState } from "react";

export interface UsePendingSubmitReturn<TArgs extends unknown[], TResult> {
  execute: (...args: TArgs) => Promise<TResult>;
  isPending: boolean;
  error: Error | null;
  reset: () => void;
}

export function usePendingSubmit<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult> | TResult,
): UsePendingSubmitReturn<TArgs, TResult> {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const pendingRef = useRef<Promise<TResult> | null>(null);

  const execute = useCallback(
    async (...args: TArgs): Promise<TResult> => {
      if (pendingRef.current !== null) {
        return pendingRef.current;
      }

      setError(null);
      setIsPending(true);

      let currentPromise: Promise<TResult> | null = null;

      currentPromise = (async () => {
        try {
          return await action(...args);
        } catch (err) {
          const caughtError =
            err instanceof Error ? err : new Error(String(err));
          setError(caughtError);
          throw caughtError;
        } finally {
          if (pendingRef.current === currentPromise) {
            pendingRef.current = null;
            setIsPending(false);
          }
        }
      })();

      pendingRef.current = currentPromise;

      return pendingRef.current;
    },
    [action],
  );

  const reset = useCallback(() => {
    setError(null);
    setIsPending(false);
    pendingRef.current = null;
  }, []);

  return { execute, isPending, error, reset };
}

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { usePendingSubmit } from "@/components/feedback/use-pending-submit";

describe("usePendingSubmit", () => {
  it("正常時に結果を返す", async () => {
    const action = vi.fn().mockResolvedValue("ok");
    const { result } = renderHook(() => usePendingSubmit(action));

    await act(async () => {
      const value = await result.current.execute("arg");
      expect(value).toBe("ok");
    });

    expect(action).toHaveBeenCalledWith("arg");
    expect(result.current.isPending).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("実行中の重複呼び出しを無視する", async () => {
    let resolve: (value: string) => void;
    const action = vi.fn(
      () =>
        new Promise<string>((r) => {
          resolve = r;
        }),
    );
    const { result } = renderHook(() => usePendingSubmit(action));

    let firstValue: string | undefined;
    let secondValue: string | undefined;

    act(() => {
      result.current.execute().then((value) => {
        firstValue = value;
      });
    });

    await waitFor(() => expect(result.current.isPending).toBe(true));

    act(() => {
      result.current.execute().then((value) => {
        secondValue = value;
      });
    });

    expect(action).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolve("ok");
    });

    expect(firstValue).toBe("ok");
    expect(secondValue).toBe("ok");
  });

  it("エラー時に error を設定する", async () => {
    const error = new Error("failed");
    const action = vi.fn().mockRejectedValue(error);
    const { result } = renderHook(() => usePendingSubmit(action));

    let caught: Error | undefined;
    await act(async () => {
      try {
        await result.current.execute();
      } catch (err) {
        caught = err as Error;
      }
    });

    expect(caught).toBe(error);
    expect(result.current.error).toBe(error);
    expect(result.current.isPending).toBe(false);
  });

  it("reset で状態を初期化する", async () => {
    const error = new Error("failed");
    const action = vi.fn().mockRejectedValue(error);
    const { result } = renderHook(() => usePendingSubmit(action));

    await act(async () => {
      try {
        await result.current.execute();
      } catch {
        // expected
      }
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.isPending).toBe(false);
  });
});

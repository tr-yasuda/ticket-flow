import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { describe, expect, it } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import { useApiErrorHandler } from "@/hooks/use-api-error-handler";

function ApiErrorTestButton() {
  const { handleApiError } = useApiErrorHandler();

  return (
    <button onClick={() => handleApiError({ status: 500 })}>
      trigger api error
    </button>
  );
}

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      {children}
      <Toaster position="top-right" duration={4000} visibleToasts={5} />
    </ThemeProvider>
  );
}

describe("useApiErrorHandler", () => {
  it("API エラー発生時にユーザー向けメッセージを Toast で表示する", async () => {
    render(
      <TestWrapper>
        <ApiErrorTestButton />
      </TestWrapper>,
    );

    fireEvent.click(screen.getByRole("button", { name: "trigger api error" }));

    expect(
      await screen.findByText(
        "システムエラーが発生しました。時間をおいて再度お試しください。",
      ),
    ).toBeInTheDocument();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { describe, expect, it } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import { useToast } from "@/hooks/use-toast";

function ToastTestButtons() {
  const { notifySuccess, notifyError, notifyInfo, notifyWarning } = useToast();

  return (
    <>
      <button onClick={() => notifySuccess("保存しました")}>
        show success
      </button>
      <button onClick={() => notifyError("保存に失敗しました")}>
        show error
      </button>
      <button onClick={() => notifyInfo("情報を確認してください")}>
        show info
      </button>
      <button onClick={() => notifyWarning("注意が必要です")}>
        show warning
      </button>
    </>
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

describe("useToast", () => {
  it("成功メッセージを Toast で表示できる", async () => {
    render(
      <TestWrapper>
        <ToastTestButtons />
      </TestWrapper>,
    );

    fireEvent.click(screen.getByRole("button", { name: "show success" }));

    expect(await screen.findByText("保存しました")).toBeInTheDocument();
  });

  it("エラーメッセージを Toast で表示できる", async () => {
    render(
      <TestWrapper>
        <ToastTestButtons />
      </TestWrapper>,
    );

    fireEvent.click(screen.getByRole("button", { name: "show error" }));

    expect(await screen.findByText("保存に失敗しました")).toBeInTheDocument();
  });

  it("情報メッセージを Toast で表示できる", async () => {
    render(
      <TestWrapper>
        <ToastTestButtons />
      </TestWrapper>,
    );

    fireEvent.click(screen.getByRole("button", { name: "show info" }));

    expect(
      await screen.findByText("情報を確認してください"),
    ).toBeInTheDocument();
  });

  it("警告メッセージを Toast で表示できる", async () => {
    render(
      <TestWrapper>
        <ToastTestButtons />
      </TestWrapper>,
    );

    fireEvent.click(screen.getByRole("button", { name: "show warning" }));

    expect(await screen.findByText("注意が必要です")).toBeInTheDocument();
  });
});

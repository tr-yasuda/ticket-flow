import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "../../src/App";

describe("App", () => {
  it("shadcn/ui の Button と Card が表示される", () => {
    render(<App />);

    expect(screen.getByText("Welcome to ticket-flow")).toBeInTheDocument();
    expect(
      screen.getByText("shadcn/ui + Tailwind CSS v4 のサンプル画面です。"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Get Started" }),
    ).toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppShell } from "@/components/layout/AppShell";

describe("AppShell", () => {
  it("renders children in the main content area", () => {
    render(<AppShell>Hello World</AppShell>);
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });

  it("displays the organization name in sidebar and header", () => {
    render(<AppShell organizationName="My Org" />);
    expect(screen.getAllByText("My Org")).toHaveLength(2);
  });

  it("displays Tickets, Members, and Settings navigation links", () => {
    render(<AppShell />);
    expect(screen.getByRole("link", { name: /Tickets/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Members/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Settings/i })).toBeInTheDocument();
  });

  it("derives the avatar fallback from the user's email initial", () => {
    render(<AppShell user={{ email: "alice@example.com" }} />);
    expect(screen.getAllByText("A")).toHaveLength(2);
  });
});

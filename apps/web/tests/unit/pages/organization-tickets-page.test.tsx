import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OrganizationTicketsPage } from "@/pages/organization-tickets-page";

describe("OrganizationTicketsPage", () => {
  it("ローディング状態を表示する", () => {
    render(<OrganizationTicketsPage organizationId="org-1" initialState="loading" />);
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });

  it("エラー状態を表示する", () => {
    render(<OrganizationTicketsPage organizationId="org-1" initialState="error" />);
    expect(screen.getByTestId("error-state")).toBeInTheDocument();
  });

  it("空状態を表示する", () => {
    render(<OrganizationTicketsPage organizationId="org-1" initialState="empty" />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("データあり状態を表示する", () => {
    render(<OrganizationTicketsPage organizationId="org-1" initialState="data" />);
    expect(screen.getByText("チケット")).toBeInTheDocument();
    expect(screen.getByTestId("organization-id")).toHaveTextContent("org-1");
  });
});

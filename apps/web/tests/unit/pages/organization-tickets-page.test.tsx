import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  OrganizationTicketsPage,
  OrganizationTicketsPageView,
} from "@/pages/organization-tickets-page";

describe("OrganizationTicketsPageView", () => {
  it("ローディング状態を表示する", () => {
    render(
      <OrganizationTicketsPageView organizationId="org-1" state="loading" />,
    );
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });

  it("エラー状態を表示する", () => {
    render(
      <OrganizationTicketsPageView organizationId="org-1" state="error" />,
    );
    expect(screen.getByTestId("error-state")).toBeInTheDocument();
  });

  it("空状態を表示する", () => {
    render(
      <OrganizationTicketsPageView organizationId="org-1" state="empty" />,
    );
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("データあり状態を表示する", () => {
    render(<OrganizationTicketsPageView organizationId="org-1" state="data" />);
    expect(screen.getByText("チケット")).toBeInTheDocument();
    expect(screen.getByTestId("organization-id")).toHaveTextContent("org-1");
  });
});

describe("OrganizationTicketsPage", () => {
  it("organizationId を表示する", () => {
    render(<OrganizationTicketsPage organizationId="org-1" />);
    expect(screen.getByText("チケット")).toBeInTheDocument();
    expect(screen.getByTestId("organization-id")).toHaveTextContent("org-1");
  });
});

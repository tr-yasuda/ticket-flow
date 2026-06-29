import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TicketDetailPage } from "@/pages/tickets/ticket-detail-page";

describe("TicketDetailPage", () => {
  it("organizationId と ticketId を表示する", () => {
    render(<TicketDetailPage organizationId="org-123" ticketId="ticket-abc" />);

    expect(
      screen.getByTestId("ticket-detail-organization-id"),
    ).toHaveTextContent("org-123");
    expect(screen.getByTestId("ticket-detail-ticket-id")).toHaveTextContent(
      "ticket-abc",
    );
    expect(
      screen.getByText("チケット詳細画面は準備中です。"),
    ).toBeInTheDocument();
  });

  it("skeleton 要素を表示する", () => {
    render(<TicketDetailPage organizationId="org-123" ticketId="ticket-abc" />);

    expect(screen.getAllByTestId("ticket-detail-skeleton")).toHaveLength(4);
  });
});

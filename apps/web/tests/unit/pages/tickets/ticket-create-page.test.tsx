import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TicketCreatePage } from "@/pages/tickets/ticket-create-page";

const navigateMock = vi.fn();

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual("@tanstack/react-router");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/hooks/use-organization-members", () => ({
  useOrganizationMembers: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    notifySuccess: vi.fn(),
    notifyError: vi.fn(),
    notifyInfo: vi.fn(),
    notifyWarning: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

vi.mock("@/lib/tickets-api", () => ({
  createTicket: vi.fn(),
}));

import { useOrganizationMembers } from "@/hooks/use-organization-members";
import { createTicket } from "@/lib/tickets-api";

function mockUseOrganizationMembers(
  overrides: Partial<ReturnType<typeof useOrganizationMembers>> = {},
) {
  const defaultValue: ReturnType<typeof useOrganizationMembers> = {
    members: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  };
  vi.mocked(useOrganizationMembers).mockReturnValue({
    ...defaultValue,
    ...overrides,
  });
}

function mockCreateTicket(
  implementation: typeof createTicket = vi.fn().mockResolvedValue({
    id: "ticket-1",
    organizationId: "org-1",
    title: "New ticket",
    description: null,
    status: "open",
    priority: "medium",
    assigneeId: null,
    createdBy: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    commentCount: 0,
  }) as unknown as typeof createTicket,
) {
  vi.mocked(createTicket).mockImplementation(implementation);
}

describe("TicketCreatePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigateMock.mockResolvedValue(undefined);
  });

  it("organizationId を表示し、フォームを表示する", () => {
    mockUseOrganizationMembers();

    render(<TicketCreatePage organizationId="org-1" />);

    expect(screen.getByText("チケット作成")).toBeInTheDocument();
    expect(screen.getByTestId("organization-id")).toHaveTextContent("org-1");
    expect(screen.getByLabelText("タイトル")).toBeInTheDocument();
  });

  it("メンバー一覧取得中はローディングを表示する", () => {
    mockUseOrganizationMembers({ isLoading: true });

    render(<TicketCreatePage organizationId="org-1" />);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("メンバー一覧取得失敗時にエラーを表示し再試行できる", async () => {
    const refetch = vi.fn();
    mockUseOrganizationMembers({
      error: new Error("failed to load members"),
      refetch,
    });

    render(<TicketCreatePage organizationId="org-1" />);
    const user = userEvent.setup();

    expect(
      screen.getByText("メンバー一覧の取得に失敗しました"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "再試行" }));

    expect(refetch).toHaveBeenCalled();
  });

  it("作成成功後にチケット詳細画面へ遷移する", async () => {
    mockUseOrganizationMembers({
      members: [
        {
          id: "member-1",
          userId: "user-1",
          name: "山田太郎",
          email: "yamada@example.com",
          role: "member",
          joinedAt: new Date(),
        },
      ],
    });
    mockCreateTicket();

    render(<TicketCreatePage organizationId="org-1" />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("タイトル"), "New ticket");
    await user.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => {
      expect(createTicket).toHaveBeenCalledWith({
        organizationId: "org-1",
        title: "New ticket",
        description: null,
        status: undefined,
        priority: undefined,
        assigneeId: null,
      });
    });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: "/app/$organizationId/tickets/$ticketId",
        params: { organizationId: "org-1", ticketId: "ticket-1" },
      });
    });
  });
});

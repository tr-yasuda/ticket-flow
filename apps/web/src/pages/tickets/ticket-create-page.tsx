import { useNavigate } from "@tanstack/react-router";
import type { TicketPriority, TicketStatus } from "@ticket-flow/shared";
import { useCallback, useMemo, type ReactElement } from "react";

import { ErrorState } from "@/components/feedback/error-state";
import { LoadingSpinner } from "@/components/feedback/loading-spinner";
import { TicketCreateForm } from "@/components/tickets/ticket-create-form";
import { useOrganizationMembers } from "@/hooks/use-organization-members";
import { useToast } from "@/hooks/use-toast";
import { createTicket } from "@/lib/tickets-api";

export type TicketCreatePageProps = {
  organizationId: string;
};

export function TicketCreatePage({
  organizationId,
}: TicketCreatePageProps): ReactElement {
  const navigate = useNavigate();
  const { notifySuccess } = useToast();
  const { members, isLoading, error, refetch } = useOrganizationMembers({
    organizationId,
    enabled: organizationId !== "",
  });

  const assigneeOptions = useMemo(
    () =>
      members.map((member) => ({
        value: member.userId,
        label: member.name ?? member.email,
      })),
    [members],
  );

  const handleSubmit = useCallback(
    async (values: {
      title: string;
      description: string | null;
      status?: TicketStatus;
      priority?: TicketPriority;
      assigneeId: string | null;
    }) => {
      const created = await createTicket({
        organizationId,
        title: values.title,
        description: values.description,
        status: values.status,
        priority: values.priority,
        assigneeId: values.assigneeId,
      });

      notifySuccess(`チケットを作成しました: ${created.title}`);

      await navigate({
        to: "/app/$organizationId/tickets/$ticketId",
        params: { organizationId, ticketId: created.id },
      });
    },
    [navigate, organizationId, notifySuccess],
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">チケット作成</h1>
      <p data-testid="organization-id">{organizationId}</p>
      {isLoading ? (
        <LoadingSpinner />
      ) : error !== null ? (
        <ErrorState
          title="メンバー一覧の取得に失敗しました"
          message={error.message}
          onRetry={refetch}
        />
      ) : (
        <TicketCreateForm
          assigneeOptions={assigneeOptions}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

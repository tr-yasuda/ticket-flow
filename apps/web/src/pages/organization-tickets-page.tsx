import { Inbox } from "lucide-react";
import type { ReactElement } from "react";

import { EmptyState, ErrorState, LoadingSpinner } from "@/components/feedback";

type OrganizationTicketsPageProps = {
  organizationId: string;
  initialState?: "loading" | "error" | "empty" | "data";
};

export function OrganizationTicketsPage({
  organizationId,
  initialState = "data",
}: OrganizationTicketsPageProps): ReactElement {
  if (initialState === "loading") {
    return <LoadingSpinner message="チケットを読み込んでいます…" />;
  }

  if (initialState === "error") {
    return (
      <ErrorState
        title="チケットの取得に失敗しました"
        message="接続を確認して、もう一度お試しください。"
        onRetry={() => {}}
      />
    );
  }

  if (initialState === "empty") {
    return (
      <EmptyState
        icon={Inbox}
        title="チケットがありません"
        description="新しいチケットを作成してください"
      >
        <button className="mt-2 rounded bg-primary px-4 py-2 text-primary-foreground">
          新規作成
        </button>
      </EmptyState>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">チケット</h1>
      <p data-testid="organization-id">{organizationId}</p>
    </div>
  );
}

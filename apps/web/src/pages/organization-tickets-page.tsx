import { Inbox } from "lucide-react";
import type { ReactElement } from "react";

import { EmptyState, ErrorState, LoadingSpinner } from "@/components/feedback";
import { Button } from "@/components/ui/button";

export type OrganizationTicketsPageViewProps = {
  organizationId: string;
  state: "loading" | "error" | "empty" | "data";
};

export function OrganizationTicketsPageView({
  organizationId,
  state,
}: OrganizationTicketsPageViewProps): ReactElement {
  if (state === "loading") {
    return <LoadingSpinner message="チケットを読み込んでいます…" />;
  }

  if (state === "error") {
    return (
      <ErrorState
        title="チケットの取得に失敗しました"
        message="接続を確認して、もう一度お試しください。"
      />
    );
  }

  if (state === "empty") {
    return (
      <EmptyState
        icon={Inbox}
        title="チケットがありません"
        description="新しいチケットを作成してください"
      >
        <Button type="button" className="mt-2">
          新規作成
        </Button>
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

type OrganizationTicketsPageProps = {
  organizationId: string;
};

export function OrganizationTicketsPage({
  organizationId,
}: OrganizationTicketsPageProps): ReactElement {
  // TODO: #48, #49 のデータ取得基盤が整備されたら内部 state + データ取得 hook に置き換える
  return (
    <OrganizationTicketsPageView organizationId={organizationId} state="data" />
  );
}

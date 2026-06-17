import { Inbox } from "lucide-react";
import type { ReactElement } from "react";

import { EmptyState, ErrorState, LoadingSpinner } from "@/components/feedback";
import { Button } from "@/components/ui/button";

type OrganizationTicketsPageProps = {
  organizationId: string;
  // TODO: #48, #49 のデータ取得基盤が整備されたら削除し、内部 state + データ取得 hook に置き換える
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
        <Button className="mt-2">新規作成</Button>
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

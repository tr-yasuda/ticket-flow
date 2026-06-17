import { Link } from "@tanstack/react-router";
import type { ReactElement } from "react";

export function NotFoundPage(): ReactElement {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-bold">ページが見つかりません</h1>
      <p className="mt-2 text-muted-foreground">
        お探しのページは存在しません。
      </p>
      <Link to="/app" className="mt-4 text-primary underline">
        アプリへ戻る
      </Link>
    </main>
  );
}

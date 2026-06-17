# ローディング・エラー・空状態表示コンポーネント設計

## 概要

Issue #50 で要求されている、データ取得中・エラー発生時・データ不在時・フォーム送信時の状態表示を共通化するための再利用可能なコンポーネント群を設計する。

## 背景

- チケット一覧・詳細画面などで統一された状態表示が必要
- 現状 `apps/web/src/components/ui/skeleton.tsx` は存在するが、ローディング・エラー・空状態の統一的な表示コンポーネントがない
- フォーム送信時の二重送信防止仕組みも未整備

## 設計方針

- shadcn/ui の既存コンポーネント（`Alert`, `Button`, `Card`, `Skeleton` など）を最大限に活用
- 新規コンポーネントは `apps/web/src/components/feedback/` に集約し、責務を明確にする
- 各コンポーネントはテスト可能な構造とする（`data-testid` の付与、小さな props インターフェース）

## コンポーネント一覧

### `LoadingSpinner`

ページ全体のローディング状態を表示する。

```tsx
<LoadingSpinner message="読み込み中…" />
```

- Props
  - `message?: string` — スピナー下に表示するメッセージ
  - `className?: string`
- 実装
  - 画面中央に配置されたスピナーアイコン（`lucide-react` の `Loader2`）
  - `data-testid="loading-spinner"`

### `EmptyState`

データが存在しない場合の表示。children によるカスタマイズを可能にする。

```tsx
<EmptyState
  icon={Inbox}
  title="チケットがありません"
  description="新しいチケットを作成してください"
>
  <Button>新規作成</Button>
</EmptyState>
```

- Props
  - `icon?: LucideIcon`
  - `title?: string`
  - `description?: string`
  - `children?: ReactNode`
  - `className?: string`
- 実装
  - shadcn/ui `Card` をベースに中央配置
  - アイコン・タイトル・説明・children を縦に積む
  - `data-testid="empty-state"`

### `InlineError`

コンポーネント内や小さな領域でのエラー表示。

```tsx
<InlineError
  message="チケットの取得に失敗しました"
  onRetry={() => refetch()}
/>
```

- Props
  - `message: string`
  - `onRetry?: () => void`
  - `className?: string`
- 実装
  - shadcn/ui `Alert`（`variant="destructive"`）
  - `onRetry` が指定された場合、Alert 内に「再試行」ボタンを配置
  - `data-testid="inline-error"`

### `ErrorState`

ページや大きな領域でのエラー表示。

```tsx
<ErrorState
  title="データの取得に失敗しました"
  message="接続を確認して、もう一度お試しください。"
  onRetry={() => refetch()}
/>
```

- Props
  - `title?: string`
  - `message: string`
  - `onRetry?: () => void`
  - `className?: string`
- 実装
  - 中央配置
  - `AlertTriangle` アイコン + タイトル + 説明 + リトライボタン
  - `data-testid="error-state"`

### `usePendingSubmit`

非同期処理の実行中状態と二重実行防止を管理する hook。

```tsx
const { execute, isPending, error, reset } = usePendingSubmit(onSubmit);

<Button onClick={execute} disabled={isPending}>
  {isPending ? "送信中…" : "送信"}
</Button>
```

- 型
  - `usePendingSubmit<TArgs extends unknown[], TResult>(action: (...args: TArgs) => Promise<TResult> | TResult)`
- 戻り値
  - `execute: (...args: TArgs) => Promise<TResult>`
  - `isPending: boolean`
  - `error: Error | null`
  - `reset: () => void`
- 動作
  - 実行中に `execute` が再度呼ばれた場合、新しい呼び出しを無視する
  - `action` の結果を返し、エラー時は `error` に設定して再スローする

## 既存ページへの適用

`OrganizationTicketsPage` に、これらのコンポーネントを使用した状態表示の例を追加する。現時点では実際のデータ取得が未実装のため、一時的な状態フラグで各状態を確認できるようにする。

```tsx
export function OrganizationTicketsPage({ organizationId }: OrganizationTicketsPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  if (isLoading) return <LoadingSpinner message="チケットを読み込んでいます…" />;
  if (error) return <ErrorState title="チケットの取得に失敗しました" message={error.message} onRetry={refetch} />;
  if (tickets.length === 0) return <EmptyState icon={Inbox} title="チケットがありません" description="新しいチケットを作成してください" />;

  return <div>...</div>;
}
```

## テスト方針

- 各コンポーネントについて Vitest + Testing Library の単体テストを作成
- `usePending-submit` については以下を検証
  - 正常実行時に結果を返す
  - 実行中の重複呼び出しを無視する
  - エラー発生時に `error` を設定する
  - `reset` で状態を初期化する

## Out of Scope

- TanStack Form の導入（別途検討）
- 各画面固有の詳細な UI 実装
- アニメーションの詳細調整

## 依存関係

- #48, #49（API 連携基盤）

## 関連 Issue

- #50

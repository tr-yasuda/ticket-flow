# Issue #123: [UI] ルーティング基盤を導入する（TanStack Router, public/protected routes, NotFound, AppShell under protected, typed params）

`apps/web` にルーティング基盤を導入し、public routes（/login, /signup）と protected routes（/app, /app/:organizationId/tickets 等）を分離する。AppShell は protected route 配下に配置する。型安全な URL params を導入する。

## Labels

- epic:ui
- priority:P0
- type:setup

## Acceptance Criteria

- [ ] TanStack Router をインストール・設定する
- [ ] public route 定義: `/login`, `/signup`
- [ ] protected route 定義: `/app`, `/app/:organizationId/tickets`
- [ ] AppShell コンポーネントが protected route 配下に配置される
- [ ] 未定義パスへの NotFound 画面を実装する
- [ ] URL params に型付けが適用される（`organizationId: string`）
- [ ] ルーティング設定に対するテストを追加する

## Out of Scope

- 認証ガード（AuthProvider 実装は別 Issue で対応）
- 実際の画面コンポーネント（Signup, Login 等は別 Issue）
- データフェッチ

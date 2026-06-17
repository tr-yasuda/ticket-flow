<<<<<<< HEAD

# Issue #143: [DevEx] Demo seed data を追加する

開発・デモ・E2E テスト用の初期データを追加する。ユーザー、アカウント、組織、チケット、コメントの一貫したデモデータセット。

## Labels

- epic:infrastructure
- priority:P1
- type:setup

## Acceptance Criteria

- [ ] デモユーザー（email: demo@example.com, password: demo1234）
- [ ] デモ組織
- [ ] デモチケット（複数件、異なるステータス・優先度）
- [ ] デモコメント
- [ ] seed スクリプトの実装（Prisma seed または SQL）
- [ ] 開発環境起動時に自動投入または手動実行可能
- [ ] README に seed 実行手順を記載

## Review Focus

- データの現実性（実際の使用シナリオに近いか）
- 機密情報（パスワード等）の取り扱い
- 本番環境への誤投入防止

## Verification

```bash
cd apps/api
pnpm run db:seed
# または
pnpm run dev
# デモデータが投入されていることを確認
```

## Out of Scope

- 本番環境の初期データ
- 大規模データセット（パフォーマンステスト用）
- # データの匿名化

# Issue #105: PostgreSQL / node-pg-migrate 関連の削除とドキュメント更新

## 概要

Prisma + SQLite への移行が完了したら、PostgreSQL / `node-pg-migrate` 関連の依存・スクリプト・ドキュメントを削除し、コードベースをクリーンに保つ。

## 受け入れ条件

- [x] `apps/api/package.json` から `pg`、`@types/pg`、`node-pg-migrate` を削除する
- [x] `apps/api/scripts/migrate.js` を削除する
- [x] `apps/api/node-pg-migrate.config.json` を削除する
- [x] `migrations/` ディレクトリ（`node-pg-migrate` 用）を削除する（Prisma 用マイグレーションは `apps/api/prisma/migrations/` にある）
- [x] `README.md` / `CLAUDE.md` の DB 接続・マイグレーション説明を Prisma + SQLite に更新する
- [x] PostgreSQL 専用 env（`DATABASE_SSL`、`DATABASE_SSL_REJECT_UNAUTHORIZED` 等）の記述を削除する
- [x] `pnpm install` 後に `pg` 関連パッケージが node_modules に残らないことを確認する

## レビュー観点

- 不要なコード・ファイルが完全に削除されているか
- ドキュメントが実装と一致しているか

## 検証コマンド

```bash
pnpm install
pnpm run typecheck
pnpm run lint
pnpm run format:check
pnpm run test
```

## スコープ外

- スキーマ変更
- 新機能追加

## ラベル

- priority:P2
- type:setup

## 依存関係

- #102
- #103
- #104
  > > > > > > > origin/main

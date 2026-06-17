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

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# ticket-flow 開発ガイド

## 概要

マルチテナント SaaS 向けチケット管理システムの基盤プロジェクト。過度な抽象化を避け、レイヤードアーキテクチャでドメイン・ユースケース・インフラ・UI を分離している。

## よく使うコマンド

```bash
# 依存関係のインストール
pnpm install

# 開発サーバー起動（Vite）
pnpm run dev

# ビルド
pnpm run build          # フロントエンド（dist-web/）
pnpm run build:server   # サーバー側 TypeScript（dist/）

# 型検査
pnpm run typecheck      # tsconfig.json / tsconfig.app.json / tsconfig.test.json / tsconfig.node.json をまとめて検査

# テスト
pnpm run test           # 全テストを一度実行
pnpm run test:watch     # ウォッチモード
pnpm run test:coverage  # カバレッジ付き

# 単一テストファイル
pnpm run test tests/unit/user.test.ts
# 単一 describe / it
pnpm run test -- -t "有効なメールアドレスでユーザーが作成できる"

# Lint / Format
pnpm run lint
pnpm run format:check
pnpm run format

# マイグレーション
pnpm run migrate
pnpm run migrate:rollback
pnpm run migrate:create -- <description>
```

## アーキテクチャ

### レイヤー構成

`src/` は以下のレイヤーに分かれる。README では `presentation/` と記載されているが、実際のディレクトリは `ui/` になっている。

- `domain/` — ドメインルール、エンティティ、値オブジェクト、リポジトリインターフェース
- `application/` — ユースケース、サービス、ドメインロジックの調整（現状は `.gitkeep`）
- `infrastructure/` — DB 接続、マイグレーション、外部サービス連携の詳細
- `ui/` — React コンポーネント（README 上は presentation）

### 重要な型と責務

- `Repository<TEntity, TId>` (`src/domain/repository.ts`) — 全リポジトリ実装の共通インターフェース
- `InMemoryRepository<TEntity, TId>` (`src/infrastructure/database/in-memory-repository.ts`) — テスト用のインメモリ実装
- `createUser()` (`src/domain/user.ts`) — 現在のドメインロジックの実例。メールアドレスの trim・検証を行う

### DB 接続

- `src/infrastructure/database/config.ts` — `DATABASE_URL` の読み取り・検証
- `src/infrastructure/database/pool.ts` — `pg.Pool` の生成
- `src/infrastructure/database/health-check.ts` — ヘルスチェック用ユーティリティ
- 統合テストは `isDatabaseConfigured(process.env) && process.env.MIGRATE_INTEGRATION_TEST === "true"` でスキップ制御される

### フロントエンド

- Vite + React 19。エントリポイントは `src/main.tsx`
- `index.html` が `src/main.tsx` を読み込む
- ビルド成果物は `dist-web/`

## テスト

- ランナー: Vitest
- DOM: happy-dom（React コンポーネントテスト用）
- セットアップ: `tests/setup.ts` で `@testing-library/jest-dom/vitest` を読み込み
- カバレッジ: `src/**/*.ts` / `src/**/*.tsx` を対象
- 統合テストの DB 関連は `DATABASE_URL` を設定し `MIGRATE_INTEGRATION_TEST=true` を付けると有効化される

## 開発フロー

1. Issue またはタスクを確認
2. `.worktrees/<branch-name>/` 以下に worktree を作成
3. 対象レイヤーに変更を加える
4. テストを追加・実行
5. Conventional Commits で commit（lefthook / commitlint で検証）
6. Pull Request を作成

### ブランチ命名規約

```text
<type>/<issue-number>-<description>
<type>/<description>
```

type: `feature`, `bugfix`, `hotfix`, `release`, `docs`, `style`, `refactor`, `test`, `chore`

### コミットメッセージ

- Conventional Commits 形式
- `.commitlintrc.json` で `@commitlint/config-conventional` を使用
- lefthook の `commit-msg` フックが自動検証
- **commit message、PR タイトル、PR 本文は日本語で記述する**

## CI / 品質ゲート

GitHub Actions (`ci.yml`) で以下を実行:

- typecheck
- test
- lint (`oxlint`)
- format check (`oxfmt`)
- dependency-review（PR 時）

ローカルでは `pnpm run typecheck && pnpm run lint && pnpm run format:check && pnpm run test` を実行すれば CI と同等の検証になる。

## 制約・注意点

- パッケージマネージャー: `pnpm@10.8.1`（`packageManager` 指定あり）
- Node: `^20.19.0 || >=22.12.0`
- Lint: `oxlint`（Biome から移行済み）。`migrations` は対象外
- Format: `oxfmt`。設定は `.oxfmtrc.jsonc`
- TypeScript: 厳格モード有効。`noImplicitAny`, `strictNullChecks` 有効

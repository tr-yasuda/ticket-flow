# ticket-flow 開発ガイド

このドキュメントは、AI コーディングエージェントが `ticket-flow` リポジトリで作業する際に必要なプロジェクト概要、技術スタック、コマンド、コーディング規約、テスト方針、セキュリティ上の注意点をまとめたものです。

## プロジェクト概要

`ticket-flow` は「マルチテナント SaaS 向けチケット管理システム」の基盤プロジェクトです。過度な抽象化を避け、ドメイン・ユースケース・インフラ・UI の責務を分離したレイヤードアーキテクチャを採用しています。

- **リポジトリ名**: `ticket-flow`
- **バージョン**: `0.0.1`
- **ライセンス**: MIT
- **パッケージマネージャー**: pnpm `11.7.0`（`packageManager` フィールドで固定）
- **Node.js**: `>=22.12.0`
- **言語**: TypeScript（厳格モード）
- **主な自然言語**: 日本語（Issue、PR、コミットメッセージ、ドキュメント、UI ラベルなど）

### ワークスペース構成

pnpm ワークスペース（`pnpm-workspace.yaml`）を使用したモノレポです。

```text
apps/
  api/      # バックエンド API（@ticket-flow/api）
  web/      # フロントエンド（@ticket-flow/web）
packages/
  shared/   # 共通型・ユーティリティ（@ticket-flow/shared）
```

## 技術スタックとアーキテクチャ

### バックエンド (`apps/api`)

- **フレームワーク**: [Hono](https://hono.dev/) + `@hono/node-server`
- **ORM / DB**: Prisma（スキーマ定義は `apps/api/prisma/schema.prisma`）
  - 現在の Prisma スキーマは `provider = "sqlite"` を使用
  - DB 接続設定 (`apps/api/src/infrastructure/database/config.ts`) は `file:` プロトコルのみを許可
- **認証**: JWT（`jose`）アクセストークン / リフレッシュトークン、パスワードは `bcrypt` でハッシュ化
- **実行形式**: Node.js ESM（`"type": "module"`）
- **主要エントリポイント**
  - `apps/api/src/server.ts` — 本番サーバー起動
  - `apps/api/src/index.ts` — パッケージ公開用エクスポート
  - `apps/api/src/presentation/app.ts` — `createApp()` Hono アプリ生成

#### レイヤー構成

```text
apps/api/src/
  domain/            # エンティティ、値オブジェクト、ドメインルール、リポジトリインターフェース
  application/       # ユースケース（register-user / login-user / logout-user / refresh-token）
  infrastructure/    # Prisma / DB / トークン設定 / サーバーポートなどの詳細
  presentation/      # Hono handler（入力受付、出力変換）
```

- `Repository<TEntity, TId>` (`apps/api/src/domain/repository.ts`) が共通リポジトリ型
- `InMemoryRepository<TEntity, TId>` (`apps/api/src/infrastructure/database/in-memory-repository.ts`) を単体テストで使用
- `UserRepository` / `RefreshTokenRepository` / `TicketRepository` は `Repository` を拡張したドメイン層のインターフェース
- 各ハンドラは `AuthDependencies` として依存を注入する形で実装
- `createAuthMiddleware` (`apps/api/src/presentation/middleware/auth-middleware.ts`) は実装されているが、現時点では `createApp` では未使用

### フロントエンド (`apps/web`)

- **フレームワーク**: React 19 + Vite 8
- **ルーティング**: TanStack Router（ファイルベースルーティング、`@tanstack/router-plugin/vite` で自動生成）
  - ルート定義は `apps/web/src/routes/` に配置
  - 生成ファイルは `apps/web/src/routeTree.gen.ts`（手動編集禁止、lint / format 対象外）
- **スタイリング**: Tailwind CSS v4（`apps/web/src/index.css` で `@import "tailwindcss"`）
- **UI ライブラリ**: shadcn/ui（`components.json` で `style: new-york`、`iconLibrary: lucide`）
  - 内部で `@base-ui/react` / `radix-ui` / `lucide-react` / `class-variance-authority` / `tailwind-merge` を使用
- **テーマ**: `next-themes`（ライト / ダーク / システム）
- **トースト**: `sonner`
- **フォント**: Geist Variable（`@fontsource-variable/geist`）
- **HTTP クライアント**: `ky`（`apps/web/src/lib/api-client.ts`）
- **エイリアス**: `@/` → `./src`（Vite / Vitest / TypeScript すべてで共通）
- **エントリポイント**: `apps/web/src/main.tsx`
- **HTML**: `apps/web/index.html`
- **ビルド出力**: `apps/web/dist/`

#### 現在の画面構成

```text
/              # ルート → /login へリダイレクト
/login         # ログイン画面（仮のタイトル表示のみ）
/signup        # 新規登録画面（仮のタイトル表示のみ）
/app           # アプリレイアウト（AppShell）
/app/          # アプリトップ
/app/$organizationId/tickets  # 組織ごとのチケット一覧（仮のタイトル表示のみ）
```

#### 認証関連のクライアント実装

- `apps/web/src/lib/token-storage.ts` — アクセストークン / リフレッシュトークンのインメモリ保持
- `apps/web/src/lib/api-client.ts` — `ky` インスタンス。Bearer ヘッダー付与、401 時のリフレッシュトークン再試行、ApiError 変換を実装
- `apps/web/src/lib/auth-api.ts` — register / login / logout API 呼び出し
- `apps/web/src/lib/api-error.ts` — API エラーメッセージの分類とトースト表示支援
- `apps/web/src/hooks/use-toast.ts` — `sonner` ラッパー
- `apps/web/src/hooks/use-api-error-handler.ts` — API エラーをトーストに変換する hook

### 共有パッケージ (`packages/shared`)

- `packages/shared/src/types/ticket.ts` で `Ticket` 型、`createTicket()`、`formatTicket()` を公開
- API からも再エクスポート (`apps/api/src/index.ts`)
- ビルドは `tsc` で `dist/` に出力

## セットアップとよく使うコマンド

```bash
# 依存関係のインストール
pnpm install

# lefthook Git フックのセットアップ（初回のみ）
pnpm run setup

# @ticket-flow/shared のビルド（api 開発 / テスト前に必要）
pnpm run build:shared
```

### 開発サーバー

```bash
# フロントエンド開発サーバー（Vite）
pnpm run dev
```

`pnpm run dev` は `@ticket-flow/web` のみを起動します。API サーバーを起動する場合は `pnpm --filter @ticket-flow/api dev`（または `cd apps/api && pnpm run dev`）を実行してください。このスクリプトは DB マイグレーション・シードの適用後にビルドし、`node dist/server.js` でサーバーを起動します。

### ビルド

```bash
# 全パッケージのビルド
pnpm run build

# shared のみ
pnpm run build:shared
```

### 型検査

```bash
# 全パッケージの型検査
pnpm run typecheck
```

### テスト

```bash
# 全テストを一度実行（shared ビルドも実施）
pnpm run test

# ルートのスクリプトテストのみ
pnpm run test:scripts

# ウォッチモード
pnpm run test:watch

# カバレッジ付き
pnpm run test:coverage
```

### Lint / Format

```bash
pnpm run lint           # oxlint
pnpm run format:check   # oxfmt での整形確認
pnpm run format         # oxfmt での整形適用
```

### マイグレーション

```bash
# Prisma（SQLite）のマイグレーション適用
pnpm --filter @ticket-flow/api exec prisma migrate deploy --schema prisma/schema.prisma

# マイグレーションを新規作成（スキーマ変更時）
pnpm --filter @ticket-flow/api exec prisma migrate dev --schema prisma/schema.prisma
```

### Seed データ

```bash
cd apps/api

# .env を作成（初回のみ。必要に応じて値を編集）
cp ../../.env.example .env

# 手動で seed を実行
pnpm run db:seed

# または dev 起動時に自動投入（migrate も含む）
pnpm run dev
```

#### デモアカウント

| 項目     | 値                 |
| -------- | ------------------ |
| email    | `demo@example.com` |
| password | `demo1234`         |

seed は冪等に実装されており、同じデータが存在する場合は更新されます。本番環境（`NODE_ENV=production`）では実行できません。

## コードスタイルガイドライン

- **フォーマッタ**: `oxfmt`（設定: `.oxfmtrc.jsonc`）
  - `printWidth: 80`、`tabWidth: 2`、スペースインデント、セミコロンあり
  - ダブルクォート、`trailingComma: all`、改行 `lf`
  - import ソート有効
- **Linter**: `oxlint`（設定: `.oxlintrc.json`）
  - `no-unused-vars: error`
  - `typescript/no-explicit-any: error`
  - 対象外: `dist/`、`node_modules/`、`**/src/routeTree.gen.ts`
- **EditorConfig**: UTF-8、LF、2 スペースインデント、最終改行あり
- **TypeScript**: 厳格モード有効
  - `noImplicitAny: true`、`strictNullChecks: true`
  - API / shared は `module: NodeNext`、`moduleResolution: NodeNext`
  - Web は `module: ESNext`、`moduleResolution: bundler`、`jsx: react-jsx`
  - Web では `noUnusedLocals` / `noUnusedParameters` / `noFallthroughCasesInSwitch` も有効
- **import 拡張子**: API / shared の ESM では相対パスに `.js` 拡張子を含める（`./domain/password.js` や `../domain/user-repository.js` など）
- **命名**: 関数・変数は camelCase、型は PascalCase。ファイル名は kebab-case
- **barrel file**: API / shared で `index.ts` を使用。shadcn/ui コンポーネントは個別ファイルで named export し、`components/ui/index.ts` のような barrel は使用しない

## テスト方針

- **ランナー**: Vitest（全パッケージ共通）
- **API**: `environment: node`、globals 有効
  - `apps/api/tests/globalSetup.ts` で `apps/api/prisma/test.db` へ migrate deploy を実行
  - `apps/api/tests/setup.ts` で `DATABASE_URL` が未設定の場合、`apps/api/prisma/test.db` をデフォルトに設定
  - `@prisma/*` は `server.deps.external` で外部化
- **Web**: `environment: happy-dom`、globals 有効
  - `apps/web/tests/setup.ts` で `@testing-library/jest-dom/vitest` を読み込み
- **Shared**: `environment: node`
- **ルートスクリプト**: `vitest.config.ts`（`scripts/**/*.test.mjs`）
- **カバレッジ**: `@vitest/coverage-v8`
  - API / shared: `src/**/*.ts`
  - Web: `src/**/*.ts`、`src/**/*.tsx`
- **テスト種別**
  - `apps/api/tests/unit/` — ドメイン / アプリケーション / ハンドラ / インフラの単体テスト
  - `apps/api/tests/integration/` — DB 接続・リポジトリ・マイグレーション・seed の統合テスト
  - `apps/web/tests/unit/` — コンポーネント / hook / lib / router の単体テスト
  - E2E テストは現状ありません

### テストで使う主要な補助クラス

- `InMemoryUserRepository`
- `InMemoryRefreshTokenRepository`
- `InMemoryTicketRepository`
- `InMemoryRepository<TEntity, TId>`（汎用）

## 開発フローと規約

### ブランチ命名

Conventional Branching に従います。

```text
<type>/<issue-number>-<description>
<type>/<description>
```

`description` は英語の kebab-case、小文字で始めます。

| type        | 用途                     |
| ----------- | ------------------------ |
| `feature/`  | 新機能                   |
| `bugfix/`   | バグ修正                 |
| `hotfix/`   | 緊急バグ修正             |
| `release/`  | リリース準備             |
| `docs/`     | ドキュメント変更         |
| `style/`    | 振る舞いに影響しない整形 |
| `refactor/` | 構造変更                 |
| `test/`     | テスト追加・修正         |
| `chore/`    | 補助ツール・依存関係更新 |

### コミットメッセージ

- Conventional Commits 形式
- `.commitlintrc.json` で `@commitlint/config-conventional` を使用（`subject-case` は無効）
- lefthook の `commit-msg` フックが自動検証
- **コミットメッセージ、PR タイトル、PR 本文は日本語で記述する**運用ルール

### Worktree

作業ブランチは `.worktrees/<branch-name>/` 以下に Git worktree として作成する運用が推奨されています（`.gitignore` で `.worktree/` と `.worktrees/` は無視されています）。

### Issue / PR

- Issue 作成補助: `pnpm run create-issue -- --title "..." --body-file <path> [--label ...]`
  - テンプレート本文の YAML frontmatter（`---` 〜 `---`）は自動で除去されます
- PR テンプレート: `.github/pull_request_template.md`
- Issue テンプレート: `.github/ISSUE_TEMPLATE/task.md`

## CI / 品質ゲート

`.github/workflows/ci.yml` で以下を実行します。

- `typecheck`
- `test`（Prisma migrate deploy 後に実行）
- `lint`（`oxlint`）
- `format:check`（`oxfmt`）
- `dependency-review`（PR 時、警告用途で `continue-on-error: true`）

CI では `LEFTHOOK: 0` を設定し、ローカルフックを無効化しています。

ローカルで CI と同等の検証を行う場合:

```bash
pnpm run typecheck && pnpm run lint && pnpm run format:check && pnpm run test
```

## 環境変数とセキュリティ

### 必須 / 設定可能な環境変数

`.env.example` をコピーして `.env` を作成します。

```bash
DATABASE_URL="file:./dev.db"           # SQLite の接続文字列
JWT_SECRET=                            # 32 バイト以上必須
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

- `JWT_SECRET` は `loadTokenConfig()` で 32 バイト以上を検証
- `DATABASE_URL` は `loadDatabaseConfig()` で `file:` プロトコルのみを許可
- `PORT` は未設定時 `3000`（`parsePort`）
- コード上では `.env` を自動読み込みする仕組みはありません。ローカル実行時は各自のシェル環境または `.env` 読み込みツールで設定してください

### フロントエンド環境変数

- `VITE_API_BASE_URL` — API のベース URL。未設定または空文字の場合 `/api` にフォールバック（`apps/web/src/lib/api-client.ts`）

### セキュリティ上の実装方針

- パスワードは `bcrypt`（salt rounds = 12）でハッシュ化
- パスワード入力検証: 8 〜 72 バイト（bcrypt の制限を考慮）
- リフレッシュトークンは SHA-256 でハッシュ化し、DB に保存（`refresh_tokens.token_hash`）
- JWT は `HS256`、発行時に `tokenType` クレームを含め、アクセストークン / リフレッシュトークンを区別
- `logout` 時は `Authorization: Bearer <refresh_token>` を受け取り、該当ハッシュのトークンを削除
- `DuplicateEmailError` などのドメインエラーをリポジトリ層から伝播させ、ハンドラで適切な HTTP ステータスに変換
- トークン類はメモリ上にのみ保持（`token-storage.ts`）。現時点では localStorage 等への永続化は行わない

### 注意点

- `.env`、`.env.*` は `.gitignore` で除外されています。機密情報を絶対にコミットしないでください
- `apps/api/prisma/test.db` などの SQLite DB ファイルも `.gitignore` で除外されています
- コミット時に lefthook / commitlint が実行されるため、コミットメッセージの形式を守ってください

## よく参照するファイル

| 用途                 | パス                                             |
| -------------------- | ------------------------------------------------ |
| ルート設定           | `package.json`、`pnpm-workspace.yaml`            |
| API サーバー起動     | `apps/api/src/server.ts`                         |
| API 公開エクスポート | `apps/api/src/index.ts`                          |
| Hono アプリ生成      | `apps/api/src/presentation/app.ts`               |
| Prisma スキーマ      | `apps/api/prisma/schema.prisma`                  |
| DB 設定読み取り      | `apps/api/src/infrastructure/database/config.ts` |
| トークン設定読み取り | `apps/api/src/infrastructure/token/config.ts`    |
| Web エントリ         | `apps/web/src/main.tsx`                          |
| Web HTML             | `apps/web/index.html`                            |
| Web Vite 設定        | `apps/web/vite.config.ts`                        |
| Web Vitest 設定      | `apps/web/vitest.config.ts`                      |
| Web ルート定義       | `apps/web/src/routes/`                           |
| Web API クライアント | `apps/web/src/lib/api-client.ts`                 |
| shadcn/ui 設定       | `apps/web/components.json`                       |
| 共有パッケージ       | `packages/shared/src/index.ts`                   |
| CI 定義              | `.github/workflows/ci.yml`                       |
| Lint 設定            | `.oxlintrc.json`                                 |
| Format 設定          | `.oxfmtrc.jsonc`                                 |
| Git フック           | `lefthook.yml`                                   |
| コミットlint         | `.commitlintrc.json`                             |

---

最終更新: 2026-06-17

# ticket-flow

マルチテナント SaaS 向けチケット管理システムの基盤プロジェクトです。
責務分離を意識したレイヤードアーキテクチャを採用し、後続の技術導入を見据えた構造を整備しています。

## プロジェクト概要

- **目的**: チケット管理に必要なドメインロジック、ユースケース、インフラストラクチャ、プレゼンテーションを明確に分離した基盤を提供する
- **対象**: マルチテナント SaaS
- **設計方針**: 過度な抽象化を避け、必要最小限の構造から始める

## ディレクトリ構造

```text
src/
  domain/          # ドメインロジック、エンティティ、値オブジェクト
  application/     # ユースケース、サービス、ドメインロジックの調整
  infrastructure/  # 外部サービス、DB、API クライアントなどの詳細
  presentation/    # 入力の受け渡し、返却形式への変換（handler/controller）

tests/
  unit/            # 単体テスト
  integration/     # 統合テスト
  e2e/             # E2E テスト
```

## セットアップ手順

```bash
# 依存関係をインストール
pnpm install
```

## 開発フロー

1. Issue またはタスクを確認する
2. `.worktrees/<branch-name>/` 以下に作業用 worktree を作成する
3. 対象レイヤーに変更を加える
4. テストを追加・実行し、振る舞いを検証する
5. Conventional Commits に従って commit する
6. Pull Request を作成し、レビューを受ける

## ブランチ命名規約

ブランチ名は Conventional Branching に従い、1 つの branch に 1 つの役割を持たせる。

```text
<type>/<issue-number>-<description>
```

Issue 番号がない場合は `<type>/<description>` とする。description は英語の kebab-case、小文字で始める。

### type の一覧

| type        | 用途                       |
| ----------- | -------------------------- |
| `feature/`  | 新機能の開発               |
| `bugfix/`   | バグ修正                   |
| `hotfix/`   | 緊急のバグ修正             |
| `release/`  | リリース準備               |
| `docs/`     | ドキュメントの変更         |
| `style/`    | 振る舞いに影響しない整形   |
| `refactor/` | 構造変更                   |
| `test/`     | テストの追加や修正         |
| `chore/`    | 補助ツールや依存関係の更新 |

### 例

```text
feature/add-user-authentication
bugfix/123-fix-header-alignment
chore/update-markdown-lint-config
```

## レイヤーの責務

- `presentation`: 入力を受け、サービスを呼び、返却形式へ写すだけにする
- `application`: ユースケースを実現するサービスを置く
- `domain`: ドメインルールと不変条件を表現する
- `infrastructure`: 永続化や外部 API 連携の詳細を閉じ込める

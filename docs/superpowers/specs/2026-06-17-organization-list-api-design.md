# Issue #18 所属組織一覧表示 API 設計

## 概要

ログイン中のユーザーが自分が所属する組織の一覧を取得できる `GET /api/organizations` エンドポイントを実装する。

## 受け入れ条件

- `GET /api/organizations` エンドポイントが作成されている（認証必須、Hono + Node.js）
- ユーザーが所属する組織の一覧が返される
- 各組織に対するユーザーのロールが含まれる
- 所属組織がない場合は空配列を返す
- 未認証の場合は 401 を返す

## 採用アプローチ

**既存リポジトリに専用メソッドを追加（アプローチ A）**

- `OrganizationMemberRepository` に `findByUserId(userId)` を追加する。
- Prisma 実装では `include: { organization: true }` により、メンバーシップと組織を 1 回のクエリで取得し N+1 を回避する。
- 必要な列のみ `select` して無駄なデータ取得を防ぐ。
- 既存のアーキテクチャ・命名規則・テストパターンに合致する。

## アーキテクチャ

```text
apps/api/src/
  application/
    list-organizations.ts           # ユースケース
  presentation/handlers/
    list-organizations-handler.ts   # Hono handler
  domain/
    organization-member-repository.ts # インターフェース拡張
  infrastructure/database/
    prisma-organization-member-repository.ts  # Prisma 実装拡張
    in-memory-organization-member-repository.ts # InMemory 実装拡張
```

- `createApp` において `GET /api/organizations` を `authMiddleware` 付きで登録する。
- ハンドラーは `c.get("userId")` で認証ユーザー ID を取得し、ユースケースを呼び出す。
- ユースケースはリポジトリ経由でデータを取得し、レスポンス用の DTO にマッピングする。

## データフロー

1. クライアントが `GET /api/organizations` に `Authorization: Bearer <token>` 付きでリクエスト。
2. `authMiddleware` がトークンを検証し、失敗時は 401 を返す。
3. ハンドラーが `userId` を取得し、`listOrganizations({ userId })` を実行。
4. ユースケースが `organizationMemberRepository.findByUserId(userId)` を呼び出す。
5. Prisma 実装が `organization_members` を `organization` と join して取得。
6. ユースケースが `{ id, name, slug, role }` の配列に変換して返す。
7. ハンドラーが `createApiSuccessResponse({ organizations: [...] })` で 200 を返す。

## API 仕様

### Request

```http
GET /api/organizations
Authorization: Bearer <access_token>
```

### Response 200 OK

```json
{
  "success": true,
  "data": {
    "organizations": [
      { "id": "org-1", "name": "Acme", "slug": "acme", "role": "owner" },
      { "id": "org-2", "name": "Globex", "slug": "globex", "role": "member" }
    ]
  }
}
```

### Response 401 Unauthorized

```json
{
  "success": false,
  "error": {
    "code": "AUTH_UNAUTHORIZED",
    "message": "認証が必要です"
  }
}
```

## 並び順・ページネーション

- 並び順: 組織名 `name` の昇順（安定した結果を返すため）。
- ページネーション: 今回は Out of Scope。空配列の場合も 200 で返す。

## エラーハンドリング

- 未認証: 認証ミドルウェアが 401 を返す。
- 予期しないエラー: `createApp` のグローバルエラーハンドラが 500 を返す。

## テスト計画

- **unit**: `list-organizations.test.ts`（InMemory リポジトリを使用）
  - 所属組織が複数ある場合
  - 所属組織がない場合は空配列
  - ロールが正しく含まれる
- **unit**: `list-organizations-handler.test.ts`
  - 認証済みユーザーが一覧を取得できる
  - 未認証時は 401
- **unit**: `app.test.ts` に `GET /api/organizations` のルート登録確認を追加
- **integration**: `prisma-organization-member-repository.test.ts` に `findByUserId` のケースを追加
  - N+1 が発生しないことを確認（クエリログまたは戻り値の構造で検証）

## Out of Scope

- 組織切り替えロジック
- 組織詳細表示
- 組織設定変更
- ページネーション

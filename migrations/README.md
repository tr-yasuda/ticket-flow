# Migrations

このディレクトリには PostgreSQL のマイグレーションを配置します。マイグレーションの実行には [node-pg-migrate](https://github.com/salsita/node-pg-migrate) を使用します。

## 命名規約

```text
YYYYMMDDHHMMSS_description.js
```

- UTC ベースのタイムスタンプ（14 桁）を接頭辞とする
- ファイル名は昇順で適用される
- `description` は変更内容を簡潔に表す kebab-case

## 例

```text
20260101000000_create-organizations-table.js
20260102000000_create-memberships-table.js
```

## コマンド

```bash
# マイグレーションを適用
pnpm run migrate

# 最後に適用したマイグレーションを 1 つロールバック
pnpm run migrate:rollback

# 新しいマイグレーションファイルを作成
pnpm run migrate:create -- <description>
```

## マイグレーションファイルの書き方

```javascript
exports.up = (pgm) => {
  pgm.createTable("organizations", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    name: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
};

exports.down = (pgm) => {
  pgm.dropTable("organizations");
};
```

## 注意

- 本ディレクトリ内の `README.md` と `*.sql` はマイグレーション適用対象外です（`node-pg-migrate.config.json` で除外設定）
- RLS ポリシーの設定は #20 で対応します

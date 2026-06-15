# Migrations

このディレクトリには PostgreSQL のマイグレーション SQL を配置します。

## 命名規約

```text
YYYYMMDDHHMMSS_description.sql
```

- UTC ベースのタイムスタンプ（14 桁）を接頭辞とする
- ファイル名は昇順で適用される
- `description` は変更内容を簡潔に表す kebab-case

## 例

```text
20260101000000_create-organizations-table.sql
20260102000000_create-memberships-table.sql
```

## 注意

- `00000000000000_template.sql` は雛形であり、マイグレーション適用対象外です
- マイグレーションシステムの本格導入は #8 で対応します
- RLS ポリシーの設定は #20 で対応します

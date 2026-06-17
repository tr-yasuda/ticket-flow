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
- データの匿名化

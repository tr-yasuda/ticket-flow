# Issue #18 所属組織一覧表示 API 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ログイン中のユーザーが自分が所属する組織の一覧を取得できる `GET /api/organizations` エンドポイントを実装する。

**Architecture:** 既存の `OrganizationMemberRepository` に `findByUserId` を追加し、Prisma で `organization_members` と `organizations` を 1 回のクエリで join 取得して N+1 を回避する。application 層でユースケースを作り、presentation 層で Hono handler を作って `createApp` に認証必須ルートとして登録する。

**Tech Stack:** Hono, Node.js ESM, Prisma (SQLite), TypeScript, Vitest

---

### Task 1: `OrganizationMemberRepository` に read model と `findByUserId` を追加

**Files:**
- Modify: `apps/api/src/domain/organization-member-repository.ts`

- [ ] **Step 1: `OrganizationMemberWithOrganization` 型と `findByUserId` を追加**

```ts
import type {
  OrganizationMember,
  OrganizationMemberId,
  OrganizationMemberRole,
} from "./organization-member.js";
import type { Repository } from "./repository.js";

export type OrganizationMemberWithOrganization = Readonly<{
  membershipId: string;
  organizationId: string;
  userId: string;
  role: OrganizationMemberRole;
  organizationName: string;
  organizationSlug: string;
}>;

export type OrganizationMemberRepository = Repository<
  OrganizationMember,
  OrganizationMemberId
> &
  Readonly<{
    findByOrganizationIdAndUserId(
      organizationId: string,
      userId: string,
    ): Promise<OrganizationMember | null>;
    findByUserId(
      userId: string,
    ): Promise<readonly OrganizationMemberWithOrganization[]>;
    withTransaction(tx: unknown): OrganizationMemberRepository;
  }>;
```

- [ ] **Step 2: 型検査を実行**

Run: `pnpm --filter @ticket-flow/api typecheck`
Expected: Pass（実装は次のタスクで追加）

---

### Task 2: `PrismaOrganizationMemberRepository` に `findByUserId` を実装

**Files:**
- Modify: `apps/api/src/infrastructure/database/prisma-organization-member-repository.ts`

- [ ] **Step 1: `OrganizationMemberWithOrganization` の import を追加**

```ts
import type {
  OrganizationMemberRepository,
  OrganizationMemberWithOrganization,
} from "../../domain/organization-member-repository.js";
```

- [ ] **Step 2: `findByUserId` メソッドを追加**

`findAll` の直後に追加する。

```ts
async findByUserId(
  userId: string,
): Promise<readonly OrganizationMemberWithOrganization[]> {
  const records = await this.prisma.organizationMember.findMany({
    where: { userId },
    select: {
      id: true,
      organizationId: true,
      userId: true,
      role: true,
      organization: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
    orderBy: {
      organization: {
        name: "asc",
      },
    },
  });
  return records.map((record) => ({
    membershipId: record.id,
    organizationId: record.organizationId,
    userId: record.userId,
    role: toOrganizationMemberRole(record.role),
    organizationName: record.organization.name,
    organizationSlug: record.organization.slug,
  }));
}
```

- [ ] **Step 3: 型検査を実行**

Run: `pnpm --filter @ticket-flow/api typecheck`
Expected: Pass

---

### Task 3: `InMemoryOrganizationMemberRepository` に `findByUserId` を実装

**Files:**
- Modify: `apps/api/src/infrastructure/database/in-memory-organization-member-repository.ts`

- [ ] **Step 1: 依存 import を追加**

```ts
import type {
  OrganizationMemberRepository,
  OrganizationMemberWithOrganization,
} from "../../domain/organization-member-repository.js";
import { InMemoryOrganizationRepository } from "./in-memory-organization-repository.js";
```

- [ ] **Step 2: コンストラクタと `findByUserId` を追加**

```ts
export class InMemoryOrganizationMemberRepository implements OrganizationMemberRepository {
  private readonly repository = new InMemoryRepository<
    OrganizationMember,
    OrganizationMemberId
  >((member) => member.id);

  constructor(
    private readonly organizationRepository?: InMemoryOrganizationRepository,
  ) {}

  // ... 既存メソッドはそのまま ...

  async findByUserId(
    userId: string,
  ): Promise<readonly OrganizationMemberWithOrganization[]> {
    const members = await this.repository.findAll();
    const result: OrganizationMemberWithOrganization[] = [];
    for (const member of members.filter((m) => m.userId === userId)) {
      const organization = this.organizationRepository
        ? await this.organizationRepository.findById(member.organizationId)
        : undefined;
      result.push({
        membershipId: member.id,
        organizationId: member.organizationId,
        userId: member.userId,
        role: member.role,
        organizationName: organization?.name ?? "",
        organizationSlug: organization?.slug ?? "",
      });
    }
    return result;
  }
}
```

- [ ] **Step 3: 型検査を実行**

Run: `pnpm --filter @ticket-flow/api typecheck`
Expected: Pass

---

### Task 4: `list-organizations` ユースケースを作成

**Files:**
- Create: `apps/api/src/application/list-organizations.ts`

- [ ] **Step 1: ユースケースファイルを作成**

```ts
import type { OrganizationMemberRepository } from "../domain/organization-member-repository.js";

export type OrganizationWithRole = Readonly<{
  id: string;
  name: string;
  slug: string;
  role: string;
}>;

export type ListOrganizationsSuccess = Readonly<{
  organizations: readonly OrganizationWithRole[];
}>;

export type ListOrganizationsResult = {
  success: true;
  data: ListOrganizationsSuccess;
};

export type ListOrganizationsDependencies = Readonly<{
  organizationMemberRepository: OrganizationMemberRepository;
}>;

export async function listOrganizations(
  userId: string,
  deps: ListOrganizationsDependencies,
): Promise<ListOrganizationsResult> {
  const memberships = await deps.organizationMemberRepository.findByUserId(
    userId,
  );

  const organizations = memberships.map((membership) => ({
    id: membership.organizationId,
    name: membership.organizationName,
    slug: membership.organizationSlug,
    role: membership.role,
  }));

  return {
    success: true,
    data: {
      organizations,
    },
  };
}
```

---

### Task 5: `list-organizations-handler` を作成

**Files:**
- Create: `apps/api/src/presentation/handlers/list-organizations-handler.ts`

- [ ] **Step 1: ハンドラーファイルを作成**

```ts
import {
  ApiErrorCode,
  createApiErrorResponse,
  createApiSuccessResponse,
} from "@ticket-flow/shared";
import type { Context } from "hono";

import {
  listOrganizations,
  type ListOrganizationsDependencies,
} from "../../application/list-organizations.js";

export function createListOrganizationsHandler(
  deps: ListOrganizationsDependencies,
) {
  return async (c: Context) => {
    const userId = c.get("userId");
    if (userId === undefined) {
      return c.json(
        createApiErrorResponse(
          ApiErrorCode.AUTH_UNAUTHORIZED,
          "認証が必要です",
        ),
        401,
      );
    }

    const result = await listOrganizations(userId, deps);
    return c.json(createApiSuccessResponse(result.data), 200);
  };
}
```

---

### Task 6: `app.ts` にルートを追加

**Files:**
- Modify: `apps/api/src/presentation/app.ts`

- [ ] **Step 1: import を追加**

```ts
import { createListOrganizationsHandler } from "./handlers/list-organizations-handler.js";
```

- [ ] **Step 2: ルートを追加**

```ts
app.get(
  "/api/organizations",
  authMiddleware,
  createListOrganizationsHandler(deps),
);
```

- [ ] **Step 3: 型検査を実行**

Run: `pnpm --filter @ticket-flow/api typecheck`
Expected: Pass

---

### Task 7: `list-organizations` ユースケースの単体テスト

**Files:**
- Create: `apps/api/tests/unit/application/list-organizations.test.ts`

- [ ] **Step 1: テストファイルを作成**

```ts
import { describe, expect, it } from "vitest";

import { listOrganizations } from "../../../src/application/list-organizations.js";
import type {
  OrganizationMemberRepository,
  OrganizationMemberWithOrganization,
} from "../../../src/domain/organization-member-repository.js";

function createMockRepository(
  memberships: OrganizationMemberWithOrganization[],
): OrganizationMemberRepository {
  return {
    findById: async () => null,
    findByOrganizationIdAndUserId: async () => null,
    findByUserId: async () => memberships,
    findAll: async () => [],
    save: async () => {},
    delete: async () => {},
    withTransaction: () => createMockRepository(memberships),
  };
}

describe("listOrganizations", () => {
  it("ユーザーが所属する組織の一覧とロールを返す", async () => {
    const repository = createMockRepository([
      {
        membershipId: "member-1",
        organizationId: "org-1",
        userId: "user-1",
        role: "owner",
        organizationName: "Acme",
        organizationSlug: "acme",
      },
      {
        membershipId: "member-2",
        organizationId: "org-2",
        userId: "user-1",
        role: "member",
        organizationName: "Globex",
        organizationSlug: "globex",
      },
    ]);

    const result = await listOrganizations("user-1", {
      organizationMemberRepository: repository,
    });

    expect(result.success).toBe(true);
    expect(result.data.organizations).toEqual([
      { id: "org-1", name: "Acme", slug: "acme", role: "owner" },
      { id: "org-2", name: "Globex", slug: "globex", role: "member" },
    ]);
  });

  it("所属組織がない場合は空配列を返す", async () => {
    const repository = createMockRepository([]);

    const result = await listOrganizations("user-1", {
      organizationMemberRepository: repository,
    });

    expect(result.success).toBe(true);
    expect(result.data.organizations).toEqual([]);
  });
});
```

---

### Task 8: `list-organizations-handler` の単体テスト

**Files:**
- Create: `apps/api/tests/unit/presentation/handlers/list-organizations-handler.test.ts`

- [ ] **Step 1: テストファイルを作成**

```ts
import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import type { OrganizationMemberRepository } from "../../../../src/domain/organization-member-repository.js";
import { createListOrganizationsHandler } from "../../../../src/presentation/handlers/list-organizations-handler.js";

function createMockRepository(
  userIdToMatch: string,
): OrganizationMemberRepository {
  return {
    findById: async () => null,
    findByOrganizationIdAndUserId: async () => null,
    findByUserId: async (userId) =>
      userId === userIdToMatch
        ? [
            {
              membershipId: "member-1",
              organizationId: "org-1",
              userId,
              role: "owner",
              organizationName: "Acme",
              organizationSlug: "acme",
            },
          ]
        : [],
    findAll: async () => [],
    save: async () => {},
    delete: async () => {},
    withTransaction() {
      return this;
    },
  };
}

function createTestApp(userId: string | undefined) {
  const app = new Hono();
  app.use(async (c, next) => {
    if (userId !== undefined) {
      c.set("userId", userId);
    }
    await next();
  });
  app.get(
    "/api/organizations",
    createListOrganizationsHandler({
      organizationMemberRepository: createMockRepository("user-1"),
    }),
  );
  return app;
}

describe("listOrganizationsHandler", () => {
  it("認証済みユーザーが所属組織一覧を取得できる", async () => {
    const app = createTestApp("user-1");

    const res = await app.request("/api/organizations");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.organizations).toEqual([
      { id: "org-1", name: "Acme", slug: "acme", role: "owner" },
    ]);
  });

  it("userId が設定されていない場合は 401 を返す", async () => {
    const app = createTestApp(undefined);

    const res = await app.request("/api/organizations");

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_UNAUTHORIZED");
  });

  it("所属組織がない場合は空配列を返す", async () => {
    const app = createTestApp("user-2");

    const res = await app.request("/api/organizations");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.organizations).toEqual([]);
  });
});
```

---

### Task 9: `app.test.ts` にテスト追加

**Files:**
- Modify: `apps/api/tests/unit/presentation/app.test.ts`

- [ ] **Step 1: 既存の `createTestApp` に `findByUserId` を追加**

```ts
organizationMemberRepository: {
  findById: async () => null,
  findByOrganizationIdAndUserId: async () => null,
  findByUserId: async () => [],
  findAll: async () => [],
  save: async () => {},
  delete: async () => {},
  withTransaction(_tx: unknown) {
    return this;
  },
},
```

- [ ] **Step 2: テストケースを追加**

既存の `POST /api/organizations` テストの後に追加する。

```ts
it("GET /api/organizations は未認証時に 401 を返す", async () => {
  const app = createTestApp();

  const response = await app.request("/api/organizations");

  expect(response.status).toBe(401);
  const body = await response.json();
  expect(body.success).toBe(false);
  expect(body.error.code).toBe("AUTH_UNAUTHORIZED");
});

it("GET /api/organizations は認証済みユーザーが所属組織一覧を取得できる", async () => {
  const app = createTestApp({
    organizationMemberRepository: {
      findById: async () => null,
      findByOrganizationIdAndUserId: async () => null,
      findByUserId: async () => [
        {
          membershipId: "member-1",
          organizationId: "org-1",
          userId: "user-id",
          role: "owner",
          organizationName: "Acme",
          organizationSlug: "acme",
        },
      ],
      findAll: async () => [],
      save: async () => {},
      delete: async () => {},
      withTransaction() {
        return this;
      },
    },
  });

  const response = await app.request("/api/organizations", {
    headers: { Authorization: "Bearer valid-token" },
  });

  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.success).toBe(true);
  expect(body.data.organizations).toEqual([
    { id: "org-1", name: "Acme", slug: "acme", role: "owner" },
  ]);
});
```

---

### Task 10: `PrismaOrganizationMemberRepository` 統合テスト追加

**Files:**
- Modify: `apps/api/tests/integration/infrastructure/repository/prisma-organization-member-repository.test.ts`

- [ ] **Step 1: テストケースを追加**

`describe.sequential` の閉じる前に追加する。

```ts
it("findByUserId でユーザーの所属組織をロール付きで取得できる", async () => {
  const organization1 = await createOrganizationRecord("Acme", "acme");
  const organization2 = await createOrganizationRecord("Globex", "globex");
  const user = await createUserRecord();
  const member1 = createOrganizationMember(
    organization1.id,
    user.id,
    "owner",
  );
  const member2 = createOrganizationMember(
    organization2.id,
    user.id,
    "member",
  );
  await repository.save(member1);
  await repository.save(member2);

  const found = await repository.findByUserId(user.id);

  expect(found).toHaveLength(2);
  expect(found).toEqual([
    {
      membershipId: member1.id,
      organizationId: organization1.id,
      userId: user.id,
      role: "owner",
      organizationName: "Acme",
      organizationSlug: "acme",
    },
    {
      membershipId: member2.id,
      organizationId: organization2.id,
      userId: user.id,
      role: "member",
      organizationName: "Globex",
      organizationSlug: "globex",
    },
  ]);
});

it("findByUserId で所属組織がない場合は空配列を返す", async () => {
  const user = await createUserRecord();

  const found = await repository.findByUserId(user.id);

  expect(found).toEqual([]);
});

it("findByUserId は組織名の昇順で返す", async () => {
  const organizationB = await createOrganizationRecord("Beta", "beta");
  const organizationA = await createOrganizationRecord("Alpha", "alpha");
  const user = await createUserRecord();
  await repository.save(
    createOrganizationMember(organizationB.id, user.id, "viewer"),
  );
  await repository.save(
    createOrganizationMember(organizationA.id, user.id, "admin"),
  );

  const found = await repository.findByUserId(user.id);

  expect(found.map((m) => m.organizationName)).toEqual(["Alpha", "Beta"]);
});
```

---

### Task 11: 全テスト実行

- [ ] **Step 1: 全テスト実行**

Run: `pnpm test`
Expected: All tests pass

---

### Task 12: コミット

- [ ] **Step 1: 変更をステージングしてコミット**

```bash
git add -A
git commit -m "feat(api): 所属組織一覧表示 API を実装（Issue #18）"
```

---

### Task 13: PR 作成

- [ ] **Step 1: リモートにプッシュ**

```bash
git push -u origin issue-18-organization-list-api
```

- [ ] **Step 2: PR を作成**

```bash
gh pr create --title "feat(api): 所属組織一覧表示 API を実装（Issue #18）" --body "## 概要

Issue #18: ログイン中のユーザーが自分が所属する組織の一覧を取得できる API を実装する。

## 変更内容

- `GET /api/organizations` エンドポイントを認証必須で追加
- `OrganizationMemberRepository` に `findByUserId` を追加
- Prisma 実装で `organization_members` と `organizations` を 1 回のクエリで join 取得し N+1 を回避
- レスポンスには組織 ID、名前、スラグ、ユーザーのロールを含める
- 所属組織がない場合は空配列を返す

## レビューフォーカス

- 自分が所属する組織のみが返されているか
- N+1 query が発生していないか
- ロール情報が正しく含まれているか

## 動作確認

```bash
pnpm test
```

Closes #18"
```

---

## Self-Review

**1. Spec coverage:**
- `GET /api/organizations` エンドポイント作成 → Task 5, 6
- 所属組織一覧返却 → Task 4, 5
- ロール含む → Task 4, 5
- 空配列返却 → Task 7, 8, 10
- 未認証 401 → Task 6（authMiddleware）+ Task 8, 9

**2. Placeholder scan:**
- TBD/TODO なし。全ステップにコードまたはコマンドを記載。

**3. Type consistency:**
- `OrganizationMemberWithOrganization` をリポジトリ層で一貫して使用。
- `role` は `OrganizationMemberRole` 型のままマッピングされる。

import { describe, expect, it } from "vitest";

import { createAuditLog, rehydrateAuditLog } from "./audit-log.js";

describe("createAuditLog", () => {
  it("組織内のエンティティ変更を表す監査ログを作成できる", () => {
    const log = createAuditLog({
      organizationId: "org-1",
      actorId: "user-1",
      entityType: "ticket",
      entityId: "ticket-1",
      action: "created",
      oldValues: { status: "open" },
      newValues: { status: "closed" },
    });

    expect(log.organizationId).toBe("org-1");
    expect(log.actorId).toBe("user-1");
    expect(log.entityType).toBe("ticket");
    expect(log.entityId).toBe("ticket-1");
    expect(log.action).toBe("created");
    expect(log.oldValues).toEqual({ status: "open" });
    expect(log.newValues).toEqual({ status: "closed" });
    expect(log.createdAt).toBeInstanceOf(Date);
  });

  it("actorId を省略できる", () => {
    const log = createAuditLog({
      organizationId: "org-1",
      entityType: "ticket",
      entityId: "ticket-1",
      action: "created",
    });

    expect(log.actorId).toBeNull();
  });

  it("actorId に null を渡せる", () => {
    const log = createAuditLog({
      organizationId: "org-1",
      actorId: null,
      entityType: "ticket",
      entityId: "ticket-1",
      action: "created",
    });

    expect(log.actorId).toBeNull();
  });

  it("oldValues と newValues を省略できる", () => {
    const log = createAuditLog({
      organizationId: "org-1",
      actorId: "user-1",
      entityType: "member",
      entityId: "member-1",
      action: "deleted",
    });

    expect(log.oldValues).toBeNull();
    expect(log.newValues).toBeNull();
  });

  it("organizationId が空文字の場合はエラー", () => {
    expect(() =>
      createAuditLog({
        organizationId: "",
        actorId: "user-1",
        entityType: "ticket",
        entityId: "ticket-1",
        action: "created",
      }),
    ).toThrow("organizationId is required");
  });

  it("actorId が空文字の場合はエラー", () => {
    expect(() =>
      createAuditLog({
        organizationId: "org-1",
        actorId: "",
        entityType: "ticket",
        entityId: "ticket-1",
        action: "created",
      }),
    ).toThrow("actorId must be a non-empty string");
  });

  it("entityType が空文字の場合はエラー", () => {
    expect(() =>
      createAuditLog({
        organizationId: "org-1",
        actorId: "user-1",
        entityType: "",
        entityId: "ticket-1",
        action: "created",
      }),
    ).toThrow("entityType is required");
  });

  it("entityId が空文字の場合はエラー", () => {
    expect(() =>
      createAuditLog({
        organizationId: "org-1",
        actorId: "user-1",
        entityType: "ticket",
        entityId: "",
        action: "created",
      }),
    ).toThrow("entityId is required");
  });

  it("action が空文字の場合はエラー", () => {
    expect(() =>
      createAuditLog({
        organizationId: "org-1",
        actorId: "user-1",
        entityType: "ticket",
        entityId: "ticket-1",
        action: "",
      }),
    ).toThrow("action is required");
  });

  it("文字列フィールドが長さ制限を超える場合はエラー", () => {
    const longId = "a".repeat(201);

    expect(() =>
      createAuditLog({
        organizationId: longId,
        actorId: "user-1",
        entityType: "ticket",
        entityId: "ticket-1",
        action: "created",
      }),
    ).toThrow("organizationId must be 200 characters or fewer");

    expect(() =>
      createAuditLog({
        organizationId: "org-1",
        actorId: longId,
        entityType: "ticket",
        entityId: "ticket-1",
        action: "created",
      }),
    ).toThrow("actorId must be a non-empty string of 200 characters or fewer");

    expect(() =>
      createAuditLog({
        organizationId: "org-1",
        actorId: "user-1",
        entityType: "ticket",
        entityId: longId,
        action: "created",
      }),
    ).toThrow("entityId must be 200 characters or fewer");

    expect(() =>
      createAuditLog({
        organizationId: "org-1",
        actorId: "user-1",
        entityType: "a".repeat(101),
        entityId: "ticket-1",
        action: "created",
      }),
    ).toThrow("entityType must be 100 characters or fewer");

    expect(() =>
      createAuditLog({
        organizationId: "org-1",
        actorId: "user-1",
        entityType: "ticket",
        entityId: "ticket-1",
        action: "a".repeat(101),
      }),
    ).toThrow("action must be 100 characters or fewer");
  });

  it("oldValues/newValues がオブジェクトでない場合はエラー", () => {
    expect(() =>
      createAuditLog({
        organizationId: "org-1",
        actorId: "user-1",
        entityType: "ticket",
        entityId: "ticket-1",
        action: "created",
        oldValues: ["invalid"] as unknown as Record<string, unknown>,
      }),
    ).toThrow("oldValues must be a plain object or null");

    expect(() =>
      createAuditLog({
        organizationId: "org-1",
        actorId: "user-1",
        entityType: "ticket",
        entityId: "ticket-1",
        action: "created",
        newValues: "invalid" as unknown as Record<string, unknown>,
      }),
    ).toThrow("newValues must be a plain object or null");
  });

  it("oldValues に循環参照が含まれる場合はエラー", () => {
    const values: Record<string, unknown> = { a: 1 };
    values.self = values;

    expect(() =>
      createAuditLog({
        organizationId: "org-1",
        actorId: "user-1",
        entityType: "ticket",
        entityId: "ticket-1",
        action: "created",
        oldValues: values,
      }),
    ).toThrow("oldValues must not contain circular references");
  });

  it("同一オブジェクトの共有参照は循環参照と誤判定しない", () => {
    const shared = { value: 1 };

    expect(() =>
      createAuditLog({
        organizationId: "org-1",
        actorId: "user-1",
        entityType: "ticket",
        entityId: "ticket-1",
        action: "created",
        oldValues: { a: shared, b: shared },
      }),
    ).not.toThrow();
  });

  it("oldValues のネスト深さが制限を超える場合はエラー", () => {
    let deep: Record<string, unknown> = { value: "bottom" };
    for (let index = 0; index < 11; index += 1) {
      deep = { nested: deep };
    }

    expect(() =>
      createAuditLog({
        organizationId: "org-1",
        actorId: "user-1",
        entityType: "ticket",
        entityId: "ticket-1",
        action: "created",
        oldValues: deep,
      }),
    ).toThrow("oldValues must not exceed 10 levels deep");
  });

  it("極端に深いネストでも RangeError にならず検証できる", () => {
    let deep: Record<string, unknown> = { value: "bottom" };
    for (let index = 0; index < 5000; index += 1) {
      deep = { nested: deep };
    }

    expect(() =>
      createAuditLog({
        organizationId: "org-1",
        actorId: "user-1",
        entityType: "ticket",
        entityId: "ticket-1",
        action: "created",
        oldValues: deep,
      }),
    ).toThrow("oldValues must not exceed 10 levels deep");
  });

  it("oldValues のシリアライズ後サイズが制限を超える場合はエラー", () => {
    const hugeValues: Record<string, unknown> = {
      data: "x".repeat(65537),
    };

    expect(() =>
      createAuditLog({
        organizationId: "org-1",
        actorId: "user-1",
        entityType: "ticket",
        entityId: "ticket-1",
        action: "created",
        oldValues: hugeValues,
      }),
    ).toThrow("oldValues must not exceed 65536 bytes when serialized");
  });
});

describe("rehydrateAuditLog", () => {
  it("DB からの値を復元できる", () => {
    const createdAt = new Date("2026-06-18T00:00:00.000Z");
    const log = rehydrateAuditLog({
      id: "log-1",
      organizationId: "org-1",
      actorId: "user-1",
      entityType: "ticket",
      entityId: "ticket-1",
      action: "updated",
      oldValues: { title: "before" },
      newValues: { title: "after" },
      createdAt,
    });

    expect(log.id).toBe("log-1");
    expect(log.createdAt).toEqual(createdAt);
  });

  it("無効な値で復元しようとするとエラー", () => {
    const createdAt = new Date("2026-06-18T00:00:00.000Z");

    expect(() =>
      rehydrateAuditLog({
        id: "",
        organizationId: "org-1",
        actorId: "user-1",
        entityType: "ticket",
        entityId: "ticket-1",
        action: "updated",
        oldValues: null,
        newValues: null,
        createdAt,
      }),
    ).toThrow("id is required");

    expect(() =>
      rehydrateAuditLog({
        id: "log-1",
        organizationId: "org-1",
        actorId: "user-1",
        entityType: "ticket",
        entityId: "ticket-1",
        action: "updated",
        oldValues: ["invalid"] as unknown as Record<string, unknown>,
        newValues: null,
        createdAt,
      }),
    ).toThrow("oldValues must be a plain object or null");
  });
});

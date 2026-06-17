import { describe, expect, it } from "vitest";

import { createOrganization as createOrganizationUseCase } from "../../../src/application/create-organization.js";
import { createOrganization } from "../../../src/domain/organization.js";
import { DuplicateSlugError } from "../../../src/domain/repository-error.js";
import { InMemoryOrganizationMemberRepository } from "../../../src/infrastructure/database/in-memory-organization-member-repository.js";
import { InMemoryOrganizationRepository } from "../../../src/infrastructure/database/in-memory-organization-repository.js";
import { noOpTransactionRunner } from "../../../src/infrastructure/database/no-op-transaction-runner.js";

describe("createOrganization ユースケース", () => {
  it("有効な入力で組織を作成する", async () => {
    const organizationRepository = new InMemoryOrganizationRepository();
    const organizationMemberRepository =
      new InMemoryOrganizationMemberRepository();

    const result = await createOrganizationUseCase(
      { name: "Acme Inc.", slug: "acme-inc", ownerUserId: "user-1" },
      {
        organizationRepository,
        organizationMemberRepository,
        transactionRunner: noOpTransactionRunner,
      },
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.organization.name).toBe("Acme Inc.");
    expect(result.data.organization.slug).toBe("acme-inc");
  });

  it("作成者を owner メンバーとして登録する", async () => {
    const organizationRepository = new InMemoryOrganizationRepository();
    const organizationMemberRepository =
      new InMemoryOrganizationMemberRepository();

    const result = await createOrganizationUseCase(
      { name: "Acme Inc.", slug: "acme-inc", ownerUserId: "user-1" },
      {
        organizationRepository,
        organizationMemberRepository,
        transactionRunner: noOpTransactionRunner,
      },
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    const member =
      await organizationMemberRepository.findByOrganizationIdAndUserId(
        result.data.organization.id,
        "user-1",
      );

    expect(member).not.toBeNull();
    expect(member?.role).toBe("owner");
  });

  it("slug が重複している場合は slug-already-exists を返す", async () => {
    const organizationRepository = new InMemoryOrganizationRepository();
    const organizationMemberRepository =
      new InMemoryOrganizationMemberRepository();
    const existing = createOrganization("Acme Inc.", "acme-inc");
    await organizationRepository.save(existing);

    const result = await createOrganizationUseCase(
      { name: "Other", slug: "acme-inc", ownerUserId: "user-1" },
      {
        organizationRepository,
        organizationMemberRepository,
        transactionRunner: noOpTransactionRunner,
      },
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe("slug-already-exists");
  });

  it("トランザクションランナーを使用する", async () => {
    const organizationRepository = new InMemoryOrganizationRepository();
    const organizationMemberRepository =
      new InMemoryOrganizationMemberRepository();
    let runnerCalled = false;
    const transactionRunner = {
      async run<T>(callback: (tx: unknown) => Promise<T>): Promise<T> {
        runnerCalled = true;
        return callback(undefined);
      },
    };

    await createOrganizationUseCase(
      { name: "Acme Inc.", slug: "acme-inc", ownerUserId: "user-1" },
      {
        organizationRepository,
        organizationMemberRepository,
        transactionRunner,
      },
    );

    expect(runnerCalled).toBe(true);
  });

  it("リポジトリが DuplicateSlugError を投げた場合は slug-already-exists を返す", async () => {
    const organizationRepository = new InMemoryOrganizationRepository();
    const organizationMemberRepository =
      new InMemoryOrganizationMemberRepository();
    const transactionRunner = {
      async run<T>(_callback: (tx: unknown) => Promise<T>): Promise<T> {
        throw new DuplicateSlugError();
      },
    };

    const result = await createOrganizationUseCase(
      { name: "Acme Inc.", slug: "acme-inc", ownerUserId: "user-1" },
      {
        organizationRepository,
        organizationMemberRepository,
        transactionRunner,
      },
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe("slug-already-exists");
  });
});

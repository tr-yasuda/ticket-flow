import { beforeEach, describe, expect, it } from "vitest";

import { createOrganization } from "../../../../src/domain/organization.js";
import { DuplicateSlugError } from "../../../../src/domain/repository-error.js";
import { InMemoryOrganizationRepository } from "../../../../src/infrastructure/database/in-memory-organization-repository.js";

describe("InMemoryOrganizationRepository", () => {
  let repository: InMemoryOrganizationRepository;

  beforeEach(() => {
    repository = new InMemoryOrganizationRepository();
  });

  it("組織を作成できる", async () => {
    const organization = createOrganization("Acme", "acme");

    await repository.save(organization);
    const found = await repository.findById(organization.id);

    expect(found).toEqual(organization);
  });

  it("組織名で検索できる", async () => {
    const acme = createOrganization("Acme", "acme");
    const globex = createOrganization("Globex", "globex");
    await repository.save(acme);
    await repository.save(globex);

    const results = await repository.findByName("ac");

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(acme);
  });

  it("組織名の検索語に前後空白があっても検索できる", async () => {
    const organization = createOrganization("Acme", "acme");
    await repository.save(organization);

    const results = await repository.findByName("  AC  ");

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(organization);
  });

  it("組織名に含まれる LIKE ワイルドカードをリテラルとして検索できる", async () => {
    const organization = createOrganization("100% Acme", "acme");
    await repository.save(organization);

    const results = await repository.findByName("100%");

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(organization);
  });

  it("組織名で一致しない場合は空配列を返す", async () => {
    const organization = createOrganization("Acme", "acme");
    await repository.save(organization);

    const results = await repository.findByName("zzz");

    expect(results).toHaveLength(0);
  });

  it("slug で組織を取得できる", async () => {
    const organization = createOrganization("Acme", "acme");
    await repository.save(organization);

    const found = await repository.findBySlug("acme");

    expect(found).toEqual(organization);
  });

  it("slug の前後空白は無視して組織を取得できる", async () => {
    const organization = createOrganization("Acme", "acme");
    await repository.save(organization);

    const found = await repository.findBySlug("  ACME  ");

    expect(found).toEqual(organization);
  });

  it("存在しない slug に対して null を返す", async () => {
    const found = await repository.findBySlug("not-found");

    expect(found).toBeNull();
  });

  it("findAll で保存したすべての組織を取得できる", async () => {
    const acme = createOrganization("Acme", "acme");
    const globex = createOrganization("Globex", "globex");
    await repository.save(acme);
    await repository.save(globex);

    const all = await repository.findAll();

    expect(all).toHaveLength(2);
    expect(all).toContainEqual(acme);
    expect(all).toContainEqual(globex);
  });

  it("save で既存組織を上書き更新できる", async () => {
    const organization = createOrganization("Acme", "acme");
    await repository.save(organization);

    const updated = { ...organization, name: "Acme Inc." };
    await repository.save(updated);

    const found = await repository.findById(organization.id);
    expect(found).toEqual(updated);
  });

  it("save で重複した slug を保存しようとすると DuplicateSlugError", async () => {
    const acme = createOrganization("Acme", "acme");
    await repository.save(acme);

    const other = createOrganization("Other", "acme");

    await expect(repository.save(other)).rejects.toBeInstanceOf(
      DuplicateSlugError,
    );
  });

  it("delete で組織を削除できる", async () => {
    const organization = createOrganization("Acme", "acme");
    await repository.save(organization);

    await repository.delete(organization.id);

    const found = await repository.findById(organization.id);
    expect(found).toBeNull();
  });
});

import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UserNotOrganizationMemberError } from "../../../src/domain/organization-member.js";
import {
  TicketConflictError,
  TicketInvalidStateError,
  TicketNotFoundError,
  TicketValidationError,
} from "../../../src/domain/ticket.js";
import {
  mapServiceError,
  runInTransaction,
} from "../../../src/services/ticket-service-base.js";

describe("ticket-service-base", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
  describe("runInTransaction", () => {
    it("PrismaClient の場合は $transaction で実行する", async () => {
      const tx = { foo: "bar" };
      const db = { $transaction: vi.fn((fn) => fn(tx)) };
      const fn = vi.fn(async (client) => ({ client }));

      const result = await runInTransaction(db as never, fn);

      expect(db.$transaction).toHaveBeenCalledWith(fn);
      expect(fn).toHaveBeenCalledWith(tx);
      expect(result).toEqual({ client: tx });
    });

    it("TransactionClient の場合は直接実行する", async () => {
      const db = { foo: "bar" };
      const fn = vi.fn(async (client) => ({ client }));

      const result = await runInTransaction(db as never, fn);

      expect(fn).toHaveBeenCalledWith(db);
      expect(result).toEqual({ client: db });
    });
  });

  describe("mapServiceError", () => {
    it("TicketConflictError を ticket-conflict に変換する", () => {
      const error = new TicketConflictError("conflict");
      const result = mapServiceError(error);

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("ticket-conflict");
      expect(result.error.message).toBe("conflict");
    });

    it("TicketNotFoundError を ticket-not-found に変換する", () => {
      const error = new TicketNotFoundError("not found");
      const result = mapServiceError(error);

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("ticket-not-found");
      expect(result.error.message).toBe("not found");
    });

    it("UserNotOrganizationMemberError を user-not-organization-member に変換する", () => {
      const error = new UserNotOrganizationMemberError("not member");
      const result = mapServiceError(error);

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("user-not-organization-member");
      expect(result.error.message).toBe("not member");
    });

    it("TicketValidationError を validation-error に変換する", () => {
      const error = new TicketValidationError("invalid");
      const result = mapServiceError(error);

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("validation-error");
      expect(result.error.message).toBe("invalid");
    });

    it("PrismaClientKnownRequestError を unknown-error に変換する", () => {
      const error = new Prisma.PrismaClientKnownRequestError("db error", {
        code: "P2002",
        clientVersion: "test",
      });
      const result = mapServiceError(error);

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("unknown-error");
      expect(result.error.message).toBe("データベースエラーが発生しました");
    });

    it("TicketInvalidStateError を unknown-error に変換する", () => {
      const error = new TicketInvalidStateError("invalid state");
      const result = mapServiceError(error);

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("unknown-error");
      expect(result.error.message).toBe("データの整合性に問題が発生しました");
    });

    it("一般的な Error を unknown-error に変換する", () => {
      const error = new Error("something went wrong");
      const result = mapServiceError(error);

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("unknown-error");
      expect(result.error.message).toBe("something went wrong");
    });

    it("Error 以外を unknown-error に変換する", () => {
      const result = mapServiceError("unknown");

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("unknown-error");
      expect(result.error.message).toBe("不明なエラーが発生しました");
    });
  });
});

import { Prisma, type PrismaClient } from "@prisma/client";

import { UserNotOrganizationMemberError } from "../domain/organization-member.js";
import {
  TicketConflictError,
  TicketInvalidStateError,
  TicketNotFoundError,
  TicketValidationError,
} from "../domain/ticket.js";

export async function runInTransaction<T>(
  db: PrismaClient | Prisma.TransactionClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (
    "$transaction" in db &&
    typeof (db as PrismaClient).$transaction === "function"
  ) {
    return (db as PrismaClient).$transaction(fn);
  }

  return fn(db as Prisma.TransactionClient);
}

export type TicketServiceError = Readonly<
  | { type: "ticket-not-found"; message: string }
  | { type: "ticket-conflict"; message: string }
  | { type: "user-not-organization-member"; message: string }
  | { type: "validation-error"; message: string }
  | { type: "unknown-error"; message: string }
>;

export function mapServiceError(error: unknown): {
  success: false;
  error: TicketServiceError;
} {
  if (error instanceof TicketConflictError) {
    return {
      success: false,
      error: { type: "ticket-conflict", message: error.message },
    };
  }

  if (error instanceof TicketNotFoundError) {
    return {
      success: false,
      error: { type: "ticket-not-found", message: error.message },
    };
  }

  if (error instanceof UserNotOrganizationMemberError) {
    return {
      success: false,
      error: { type: "user-not-organization-member", message: error.message },
    };
  }

  if (error instanceof TicketValidationError) {
    return {
      success: false,
      error: { type: "validation-error", message: error.message },
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    console.error("Prisma error:", error);
    return {
      success: false,
      error: {
        type: "unknown-error",
        message: "データベースエラーが発生しました",
      },
    };
  }

  if (error instanceof TicketInvalidStateError) {
    console.error("Ticket data integrity error:", error);
    return {
      success: false,
      error: {
        type: "unknown-error",
        message: "データの整合性に問題が発生しました",
      },
    };
  }

  if (error instanceof Error) {
    return {
      success: false,
      error: { type: "unknown-error", message: error.message },
    };
  }

  return {
    success: false,
    error: { type: "unknown-error", message: "不明なエラーが発生しました" },
  };
}

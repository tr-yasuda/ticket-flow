import { type Prisma, type PrismaClient } from "@prisma/client";

import { createAuditLog, type AuditLogValues } from "../domain/audit-log.js";
import {
  createTicket as createTicketEntity,
  type CreateTicketInput as DomainCreateTicketInput,
  TicketConflictError,
  TicketNotFoundError,
  TicketPriority,
  TicketStatus,
  type Ticket,
  type UpdateTicketPatch,
  updateTicket as updateTicketEntity,
  updateTicketAssignee as updateTicketAssigneeEntity,
  updateTicketPriority as updateTicketPriorityEntity,
  updateTicketStatus as updateTicketStatusEntity,
} from "../domain/ticket.js";
import { saveAuditLog } from "../infrastructure/database/audit-log-repository.js";
import {
  findTicketById,
  saveTicket,
  softDeleteTicket,
  updateTicket as updateTicketRepository,
  updateTicketAssignee as updateTicketAssigneeRepository,
  updateTicketPriority as updateTicketPriorityRepository,
  updateTicketStatus as updateTicketStatusRepository,
} from "../infrastructure/database/ticket-repository.js";
import { assertUserIsOrganizationMember } from "../lib/membership-assertions.js";
import { prisma } from "../lib/prisma.js";
import {
  mapServiceError,
  runInTransaction,
  type TicketServiceError,
} from "./ticket-service-base.js";

export type { TicketServiceError } from "./ticket-service-base.js";

export type CreateTicketServiceInput = Readonly<{
  organizationId: string;
  title: string;
  description?: string;
  priority?: TicketPriority;
  assigneeId?: string | null;
  createdBy: string;
  /**
   * 作成者の組織メンバーシップチェックをスキップする。
   * 呼び出し元で既にメンバーシップを確認している場合（例: organizationScopeMiddleware 経由）に true を指定する。
   * assigneeId の組織メンバーシップチェックは常に実行される。
   */
  skipCreatorMembershipCheck?: boolean;
}>;

export type CreateTicketResult =
  | { success: true; data: { ticket: Ticket } }
  | { success: false; error: TicketServiceError };

export async function createTicket(
  input: CreateTicketServiceInput,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<CreateTicketResult> {
  try {
    const domainInput: DomainCreateTicketInput = {
      organizationId: input.organizationId,
      title: input.title,
      description: input.description,
      priority: input.priority,
      assigneeId:
        input.assigneeId === undefined || input.assigneeId === null
          ? null
          : input.assigneeId.toLowerCase(),
      createdBy: input.createdBy.toLowerCase(),
    };

    const ticket = createTicketEntity(domainInput);

    const saved = await runInTransaction(db, async (tx) => {
      await Promise.all([
        input.skipCreatorMembershipCheck === true
          ? Promise.resolve()
          : assertUserIsOrganizationMember(
              tx,
              ticket.organizationId,
              ticket.createdBy,
            ),
        ticket.assigneeId !== null
          ? assertUserIsOrganizationMember(
              tx,
              ticket.organizationId,
              ticket.assigneeId,
            )
          : Promise.resolve(),
      ]);

      return saveTicket(ticket, tx);
    });

    return { success: true, data: { ticket: saved } };
  } catch (error) {
    return mapServiceError(error);
  }
}

export type UpdateTicketInput = Readonly<{
  organizationId: string;
  ticketId: string;
  updatedBy: string;
  title?: string;
  description?: string | null;
  priority?: TicketPriority;
}>;

export type UpdateTicketResult =
  | { success: true; data: { ticket: Ticket } }
  | { success: false; error: TicketServiceError };

function ticketToAuditLogValues(ticket: Ticket): AuditLogValues {
  return {
    title: ticket.title,
    description: ticket.description,
    priority: ticket.priority,
    status: ticket.status,
    assigneeId: ticket.assigneeId,
  };
}

export async function updateTicket(
  input: UpdateTicketInput,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<UpdateTicketResult> {
  try {
    const ticket = await runInTransaction(db, async (tx) => {
      const existing = await findTicketById(
        { organizationId: input.organizationId, ticketId: input.ticketId },
        tx,
      );
      if (existing === null) {
        throw new TicketNotFoundError(
          `チケット ${input.ticketId} が見つかりません`,
        );
      }

      const patch: UpdateTicketPatch = {
        title: input.title,
        description: input.description,
        priority: input.priority,
      };
      const updated = updateTicketEntity(existing, patch);

      const saved = await updateTicketRepository(
        {
          organizationId: input.organizationId,
          ticketId: input.ticketId,
          title: updated.title,
          description: updated.description,
          priority: updated.priority,
        },
        tx,
      );

      if (saved === null) {
        throw new TicketNotFoundError(
          `チケット ${input.ticketId} が見つかりません`,
        );
      }

      const auditLog = createAuditLog({
        organizationId: input.organizationId,
        actorId: input.updatedBy,
        entityType: "ticket",
        entityId: saved.id,
        action: "update",
        oldValues: ticketToAuditLogValues(existing),
        newValues: ticketToAuditLogValues(saved),
      });
      await saveAuditLog(auditLog, tx);

      return saved;
    });

    return { success: true, data: { ticket } };
  } catch (error) {
    return mapServiceError(error);
  }
}

export type UpdateTicketStatusInput = Readonly<{
  organizationId: string;
  ticketId: string;
  status: TicketStatus;
  updatedBy: string;
}>;

export type UpdateTicketStatusResult =
  | { success: true; data: { ticket: Ticket } }
  | { success: false; error: TicketServiceError };

export async function updateTicketStatus(
  input: UpdateTicketStatusInput,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<UpdateTicketStatusResult> {
  try {
    const updatedTicket = await runInTransaction(db, async (tx) => {
      const existing = await findTicketById(
        { organizationId: input.organizationId, ticketId: input.ticketId },
        tx,
      );
      if (existing === null) {
        throw new TicketNotFoundError(
          `チケット ${input.ticketId} が見つかりません`,
        );
      }

      const updated = updateTicketStatusEntity(existing, input.status);

      if (updated.status === existing.status) {
        return existing;
      }

      const saved = await updateTicketStatusRepository(
        {
          organizationId: input.organizationId,
          ticketId: input.ticketId,
          status: updated.status,
          currentStatus: existing.status,
        },
        tx,
      );

      if (saved === null) {
        const latest = await findTicketById(
          { organizationId: input.organizationId, ticketId: input.ticketId },
          tx,
        );
        if (latest === null) {
          throw new TicketNotFoundError(
            `チケット ${input.ticketId} が見つかりません`,
          );
        }
        throw new TicketConflictError(
          "チケットのステータスが変更されたため、更新できません。最新の状態を確認してください。",
        );
      }

      const auditLog = createAuditLog({
        organizationId: input.organizationId,
        actorId: input.updatedBy,
        entityType: "ticket",
        entityId: saved.id,
        action: "update_status",
        oldValues: { status: existing.status },
        newValues: { status: saved.status },
      });
      await saveAuditLog(auditLog, tx);

      return saved;
    });

    return { success: true, data: { ticket: updatedTicket } };
  } catch (error) {
    return mapServiceError(error);
  }
}

export type UpdateTicketPriorityInput = Readonly<{
  organizationId: string;
  ticketId: string;
  priority: TicketPriority;
  updatedBy: string;
}>;

export type UpdateTicketPriorityResult =
  | { success: true; data: { ticket: Ticket } }
  | { success: false; error: TicketServiceError };

export async function updateTicketPriority(
  input: UpdateTicketPriorityInput,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<UpdateTicketPriorityResult> {
  try {
    const updatedTicket = await runInTransaction(db, async (tx) => {
      const existing = await findTicketById(
        { organizationId: input.organizationId, ticketId: input.ticketId },
        tx,
      );
      if (existing === null) {
        throw new TicketNotFoundError(
          `チケット ${input.ticketId} が見つかりません`,
        );
      }

      const updated = updateTicketPriorityEntity(existing, input.priority);

      if (updated.priority === existing.priority) {
        return existing;
      }

      const saved = await updateTicketPriorityRepository(
        {
          organizationId: input.organizationId,
          ticketId: input.ticketId,
          priority: updated.priority,
          currentPriority: existing.priority,
        },
        tx,
      );

      if (saved === null) {
        const latest = await findTicketById(
          { organizationId: input.organizationId, ticketId: input.ticketId },
          tx,
        );
        if (latest === null) {
          throw new TicketNotFoundError(
            `チケット ${input.ticketId} が見つかりません`,
          );
        }
        throw new TicketConflictError(
          "チケットの優先度が変更されたため、更新できません。最新の状態を確認してください。",
        );
      }

      const auditLog = createAuditLog({
        organizationId: input.organizationId,
        actorId: input.updatedBy,
        entityType: "ticket",
        entityId: saved.id,
        action: "update_priority",
        oldValues: { priority: existing.priority },
        newValues: { priority: saved.priority },
      });
      await saveAuditLog(auditLog, tx);

      return saved;
    });

    return { success: true, data: { ticket: updatedTicket } };
  } catch (error) {
    return mapServiceError(error);
  }
}

export type UpdateTicketAssigneeInput = Readonly<{
  organizationId: string;
  ticketId: string;
  assigneeId: string | null;
  updatedBy: string;
}>;

export type UpdateTicketAssigneeResult =
  | { success: true; data: { ticket: Ticket } }
  | { success: false; error: TicketServiceError };

export async function updateTicketAssignee(
  input: UpdateTicketAssigneeInput,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<UpdateTicketAssigneeResult> {
  try {
    const existing = await findTicketById(
      { organizationId: input.organizationId, ticketId: input.ticketId },
      db,
    );
    if (existing === null) {
      return {
        success: false,
        error: {
          type: "ticket-not-found",
          message: "チケットが見つかりません",
        },
      };
    }

    const normalizedAssigneeId =
      input.assigneeId === null ? null : input.assigneeId.toLowerCase();

    const updatedEntity = updateTicketAssigneeEntity(
      existing,
      normalizedAssigneeId,
    );
    if (updatedEntity.assigneeId === existing.assigneeId) {
      return { success: true, data: { ticket: existing } };
    }

    const saved = await runInTransaction(db, async (tx) => {
      if (updatedEntity.assigneeId !== null) {
        await assertUserIsOrganizationMember(
          tx,
          input.organizationId,
          updatedEntity.assigneeId,
        );
      }

      const result = await updateTicketAssigneeRepository(
        {
          organizationId: input.organizationId,
          ticketId: input.ticketId,
          assigneeId: updatedEntity.assigneeId,
          currentAssigneeId: existing.assigneeId,
        },
        tx,
      );

      if (result === null) {
        const latest = await findTicketById(
          { organizationId: input.organizationId, ticketId: input.ticketId },
          tx,
        );
        if (latest === null) {
          throw new TicketNotFoundError(
            `チケット ${input.ticketId} が見つかりません`,
          );
        }
        throw new TicketConflictError(
          "チケットの担当者が変更されたため、更新できません。最新の状態を確認してください。",
        );
      }

      const auditLog = createAuditLog({
        organizationId: input.organizationId,
        actorId: input.updatedBy,
        entityType: "ticket",
        entityId: result.id,
        action: "update_assignee",
        oldValues: { assigneeId: existing.assigneeId },
        newValues: { assigneeId: result.assigneeId },
      });
      await saveAuditLog(auditLog, tx);

      return result;
    });

    return { success: true, data: { ticket: saved } };
  } catch (error) {
    return mapServiceError(error);
  }
}

export type DeleteTicketInput = Readonly<{
  organizationId: string;
  ticketId: string;
  deletedBy: string;
}>;

export type DeleteTicketResult =
  | { success: true; data: { ticket: Ticket } }
  | { success: false; error: TicketServiceError };

export async function deleteTicket(
  input: DeleteTicketInput,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<DeleteTicketResult> {
  try {
    return await runInTransaction(db, async (tx) => {
      const existing = await findTicketById(
        { organizationId: input.organizationId, ticketId: input.ticketId },
        tx,
      );
      if (existing === null) {
        return {
          success: false,
          error: {
            type: "ticket-not-found",
            message: "チケットが見つかりません",
          },
        };
      }

      const deleted = await softDeleteTicket(
        { organizationId: input.organizationId, ticketId: input.ticketId },
        tx,
      );
      if (deleted === null) {
        return {
          success: false,
          error: {
            type: "ticket-not-found",
            message: "チケットが見つかりません",
          },
        };
      }

      const auditLog = createAuditLog({
        organizationId: input.organizationId,
        actorId: input.deletedBy,
        entityType: "ticket",
        entityId: deleted.id,
        action: "delete",
        oldValues: ticketToAuditLogValues(existing),
        newValues: { deletedAt: deleted.deletedAt!.toISOString() },
      });
      await saveAuditLog(auditLog, tx);

      return { success: true, data: { ticket: deleted } };
    });
  } catch (error) {
    return mapServiceError(error);
  }
}

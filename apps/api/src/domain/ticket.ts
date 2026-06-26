import { randomUUID } from "node:crypto";

import {
  createTicketInputSchema,
  ticketAssigneeIdSchema,
  ticketCreatedBySchema,
  ticketDescriptionSchema,
  ticketOrganizationIdSchema,
  ticketPrioritySchema,
  ticketStatusSchema,
  ticketTitleSchema,
  updateTicketInputSchema,
} from "@ticket-flow/shared";
import { z } from "zod";

export type TicketId = string;

export const TicketStatus = {
  Open: "open",
  InProgress: "in-progress",
  Closed: "closed",
} as const;
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const TicketPriority = {
  Low: "low",
  Medium: "medium",
  High: "high",
  Urgent: "urgent",
} as const;
export type TicketPriority =
  (typeof TicketPriority)[keyof typeof TicketPriority];

export type Ticket = Readonly<{
  id: TicketId;
  organizationId: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  assigneeId: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}>;

export type TicketAssignee = Readonly<{
  id: string;
  name: string | null;
}>;

export type TicketListItem = Readonly<{
  id: TicketId;
  organizationId: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignee: TicketAssignee | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}>;

export class TicketValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TicketValidationError";
  }
}

export class TicketNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TicketNotFoundError";
  }
}

export class TicketConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TicketConflictError";
  }
}

export class UserNotOrganizationMemberError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserNotOrganizationMemberError";
  }
}

const ticketSchema = z.object({
  id: z
    .string({ message: "チケットIDは必須です" })
    .min(1, "チケットIDは必須です"),
  organizationId: ticketOrganizationIdSchema,
  title: ticketTitleSchema,
  description: ticketDescriptionSchema.transform((value) => value ?? null),
  status: ticketStatusSchema,
  priority: ticketPrioritySchema,
  assigneeId: ticketAssigneeIdSchema.transform((value) => value ?? null),
  createdBy: ticketCreatedBySchema,
  createdAt: z.date({ message: "作成日時は必須です" }),
  updatedAt: z.date({ message: "更新日時は必須です" }),
});

function parseWith<T>(schema: z.ZodType<T>, input: unknown): T {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstIssue = error.issues[0];
      throw new TicketValidationError(
        firstIssue?.message ?? "入力内容を確認してください",
      );
    }
    throw error;
  }
}

export type CreateTicketInput = Readonly<{
  organizationId: string;
  title: string;
  description?: string;
  priority?: TicketPriority;
  assigneeId?: string | null;
  createdBy: string;
}>;

export function createTicket(input: CreateTicketInput): Ticket {
  const parsed = parseWith(createTicketInputSchema, input);
  const now = new Date();

  return parseWith(ticketSchema, {
    id: randomUUID(),
    organizationId: parsed.organizationId,
    title: parsed.title,
    description: parsed.description ?? null,
    status: TicketStatus.Open,
    priority: parsed.priority ?? TicketPriority.Medium,
    assigneeId: parsed.assigneeId ?? null,
    createdBy: parsed.createdBy,
    createdAt: now,
    updatedAt: now,
  });
}

export type RehydrateTicketInput = Readonly<{
  id: TicketId;
  organizationId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}>;

export function rehydrateTicket(input: RehydrateTicketInput): Ticket {
  return parseWith(ticketSchema, input);
}

export type UpdateTicketPatch = Readonly<{
  title?: string;
  description?: string | null;
  priority?: TicketPriority;
}>;

export function updateTicket(ticket: Ticket, patch: UpdateTicketPatch): Ticket {
  const parsed = parseWith(updateTicketInputSchema, patch);

  return parseWith(ticketSchema, {
    ...ticket,
    title: parsed.title ?? ticket.title,
    description:
      parsed.description !== undefined
        ? parsed.description
        : ticket.description,
    priority: parsed.priority ?? ticket.priority,
    updatedAt: new Date(),
  });
}

const allowedStatusTransitions: Record<TicketStatus, readonly TicketStatus[]> =
  {
    [TicketStatus.Open]: [TicketStatus.InProgress, TicketStatus.Closed],
    [TicketStatus.InProgress]: [TicketStatus.Closed],
    [TicketStatus.Closed]: [],
  };

function validateTicketStatusTransition(
  fromStatus: TicketStatus,
  toStatus: TicketStatus,
): void {
  if (fromStatus === toStatus) {
    return;
  }

  const allowed = allowedStatusTransitions[fromStatus];
  if (!allowed.includes(toStatus)) {
    throw new TicketValidationError(
      `ステータスを ${fromStatus} から ${toStatus} に変更することはできません`,
    );
  }
}

/**
 * チケットのステータスを変更する。
 *
 * 許可される遷移:
 * - open → in-progress
 * - open → closed
 * - in-progress → closed
 *
 * 同じステータスへの変更はエラーにならない。
 * 上記以外の遷移は TicketValidationError を投げる。
 */
export function updateTicketStatus(
  ticket: Ticket,
  status: TicketStatus,
): Ticket {
  const parsed = parseWith(ticketStatusSchema, status);
  validateTicketStatusTransition(ticket.status, parsed);

  return parseWith(ticketSchema, {
    ...ticket,
    status: parsed,
    updatedAt: new Date(),
  });
}

/**
 * チケットの優先度を変更する。
 *
 * 同じ優先度への変更はエラーにならない。
 * 無効な優先度値は TicketValidationError を投げる。
 */
export function updateTicketPriority(
  ticket: Ticket,
  priority: TicketPriority,
): Ticket {
  const parsed = parseWith(ticketPrioritySchema, priority);

  return parseWith(ticketSchema, {
    ...ticket,
    priority: parsed,
    updatedAt: new Date(),
  });
}

/**
 * チケットの担当者を変更する。
 *
 * 同じ担当者への変更はエラーにならず、updatedAt も変更しない。
 * 空文字の担当者IDは TicketValidationError を投げる。
 *
 * NOTE: この関数は `ticketAssigneeIdSchema` を使い、UUID 形式の検証は行わない。
 * 空文字・null・undefined の正規化のみを担当する。
 * UUID 形式や組織メンバーシップの検証は、API 境界（`updateTicketAssigneeInputSchema`）
 * および service 層で別途行う。
 *
 * NOTE: service 層で organization_members 確認後に UPDATE を行うが、两者之间に
 * メンバーが削除されるレースコンディションはありうる。チケットの assignee_id は
 * users への FK だが organization_members への FK ではないため、担当者が組織に
 * 所属しなくなってもチケットは残る。現状では許容し、次回変更時に検出・解消する。
 */
export function updateTicketAssignee(
  ticket: Ticket,
  assigneeId: string | null,
): Ticket {
  const parsed = parseWith(ticketAssigneeIdSchema, assigneeId);

  if (parsed === ticket.assigneeId) {
    return ticket;
  }

  return parseWith(ticketSchema, {
    ...ticket,
    assigneeId: parsed,
    updatedAt: new Date(),
  });
}

import { randomUUID } from "node:crypto";

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

export class TicketValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TicketValidationError";
  }
}

const MAX_TICKET_TITLE_LENGTH = 200;
const MAX_TICKET_DESCRIPTION_LENGTH = 10000;

const ticketStatuses: readonly TicketStatus[] = [
  TicketStatus.Open,
  TicketStatus.InProgress,
  TicketStatus.Closed,
];

const ticketPriorities: readonly TicketPriority[] = [
  TicketPriority.Low,
  TicketPriority.Medium,
  TicketPriority.High,
  TicketPriority.Urgent,
];

function isNonEmptyString(value: string): boolean {
  return value.trim().length > 0;
}

function isValidTitleLength(title: string): boolean {
  return title.length <= MAX_TICKET_TITLE_LENGTH;
}

function isValidStatus(status: string): status is TicketStatus {
  return (ticketStatuses as readonly string[]).includes(status);
}

function isValidPriority(priority: string): priority is TicketPriority {
  return (ticketPriorities as readonly string[]).includes(priority);
}

function isValidOptionalId(value: string | null): value is string | null {
  return value === null || isNonEmptyString(value);
}

function normalizeDescription(
  description: string | null | undefined,
): string | null {
  if (description === undefined || description === null) {
    return null;
  }
  const trimmed = description.trim();
  return trimmed.length > 0 ? trimmed : null;
}

type TicketValidationPayload = Readonly<{
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

function validateTicket(payload: TicketValidationPayload): Ticket {
  if (!isNonEmptyString(payload.id)) {
    throw new TicketValidationError("チケットIDは必須です");
  }

  if (!isNonEmptyString(payload.organizationId)) {
    throw new TicketValidationError("組織IDは必須です");
  }

  if (!isNonEmptyString(payload.title)) {
    throw new TicketValidationError("タイトルは必須です");
  }

  if (!isValidTitleLength(payload.title)) {
    throw new TicketValidationError(
      `タイトルは${MAX_TICKET_TITLE_LENGTH}文字以内で入力してください`,
    );
  }

  if (!isValidStatus(payload.status)) {
    throw new TicketValidationError(
      `ステータスの値が正しくありません: ${payload.status}`,
    );
  }

  if (!isValidPriority(payload.priority)) {
    throw new TicketValidationError(
      `優先度の値が正しくありません: ${payload.priority}`,
    );
  }

  if (!isValidOptionalId(payload.assigneeId)) {
    throw new TicketValidationError(
      "担当者IDは空文字でない文字列またはnullである必要があります",
    );
  }

  if (
    payload.description !== null &&
    payload.description.length > MAX_TICKET_DESCRIPTION_LENGTH
  ) {
    throw new TicketValidationError(
      `説明は${MAX_TICKET_DESCRIPTION_LENGTH}文字以内で入力してください`,
    );
  }

  if (!isNonEmptyString(payload.createdBy)) {
    throw new TicketValidationError("作成者IDは必須です");
  }

  return {
    id: payload.id,
    organizationId: payload.organizationId,
    title: payload.title,
    description: payload.description,
    status: payload.status,
    priority: payload.priority,
    assigneeId: payload.assigneeId,
    createdBy: payload.createdBy,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
  };
}

export type CreateTicketInput = Readonly<{
  organizationId: string;
  title: string;
  description?: string | null;
  priority?: TicketPriority;
  assigneeId?: string | null;
  createdBy: string;
}>;

export function createTicket(input: CreateTicketInput): Ticket {
  const now = new Date();
  return validateTicket({
    id: randomUUID(),
    organizationId: input.organizationId,
    title: input.title.trim(),
    description: normalizeDescription(input.description),
    status: TicketStatus.Open,
    priority: input.priority ?? TicketPriority.Medium,
    assigneeId: input.assigneeId ?? null,
    createdBy: input.createdBy,
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
  return validateTicket({
    id: input.id,
    organizationId: input.organizationId,
    title: input.title.trim(),
    description: normalizeDescription(input.description),
    status: input.status,
    priority: input.priority,
    assigneeId: input.assigneeId,
    createdBy: input.createdBy,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });
}

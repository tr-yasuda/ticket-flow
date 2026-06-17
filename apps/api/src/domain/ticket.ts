export type TicketId = string;

export type Ticket = Readonly<{
  id: TicketId;
  title: string;
  status: "open" | "in-progress" | "closed";
}>;

const MAX_TICKET_TITLE_LENGTH = 200;

const ticketStatuses: readonly Ticket["status"][] = [
  "open",
  "in-progress",
  "closed",
];

function isNonEmptyString(value: string): boolean {
  return value.trim().length > 0;
}

function isValidTitleLength(title: string): boolean {
  return title.trim().length <= MAX_TICKET_TITLE_LENGTH;
}

function isValidStatus(status: string): status is Ticket["status"] {
  return (ticketStatuses as readonly string[]).includes(status);
}

function validateTicket(id: TicketId, title: string, status: string): Ticket {
  if (!isNonEmptyString(id)) {
    throw new Error("Ticket id is required");
  }

  if (!isNonEmptyString(title)) {
    throw new Error("Ticket title is required");
  }

  if (!isValidTitleLength(title)) {
    throw new Error(
      `Ticket title must be ${MAX_TICKET_TITLE_LENGTH} characters or fewer`,
    );
  }

  if (!isValidStatus(status)) {
    throw new Error(`Invalid ticket status: ${status}`);
  }

  return {
    id,
    title,
    status,
  };
}

export function createTicket(id: TicketId, title: string): Ticket {
  return validateTicket(id, title, "open");
}

export function rehydrateTicket(
  id: TicketId,
  title: string,
  status: string,
): Ticket {
  return validateTicket(id, title, status);
}

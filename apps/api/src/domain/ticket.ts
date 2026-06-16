export type Ticket = Readonly<{
  id: string;
  title: string;
  status: "open" | "in-progress" | "closed";
}>;

const MAX_TICKET_TITLE_LENGTH = 200;

function isNonEmptyString(value: string): boolean {
  return value.trim().length > 0;
}

function isValidTitleLength(title: string): boolean {
  return title.trim().length <= MAX_TICKET_TITLE_LENGTH;
}

export function createTicket(id: string, title: string): Ticket {
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

  return {
    id,
    title,
    status: "open",
  };
}

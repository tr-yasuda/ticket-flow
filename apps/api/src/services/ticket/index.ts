export type { TicketServiceError } from "../ticket-command-service.js";

export {
  createTicket,
  deleteTicket,
  type CreateTicketResult,
  type CreateTicketServiceInput,
  type DeleteTicketInput,
  type DeleteTicketResult,
  type UpdateTicketAssigneeInput,
  type UpdateTicketAssigneeResult,
  type UpdateTicketInput,
  type UpdateTicketPriorityInput,
  type UpdateTicketPriorityResult,
  type UpdateTicketResult,
  type UpdateTicketStatusInput,
  type UpdateTicketStatusResult,
  updateTicket,
  updateTicketAssignee,
  updateTicketPriority,
  updateTicketStatus,
} from "../ticket-command-service.js";

export {
  getTicket,
  getTicketHistory,
  listTickets,
  type GetTicketHistoryInput,
  type GetTicketHistoryResult,
  type GetTicketInput,
  type GetTicketResult,
  type ListTicketsResult,
} from "../ticket-query-service.js";

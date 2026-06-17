import type { Repository } from "./repository.js";
import type { Ticket, TicketId } from "./ticket.js";

export type TicketRepository = Repository<Ticket, TicketId>;

import { authHandlers } from "./auth.js";
import { organizationHandlers } from "./organizations.js";
import { ticketHandlers } from "./tickets.js";

export const handlers = [
  ...authHandlers,
  ...organizationHandlers,
  ...ticketHandlers,
];

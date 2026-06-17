export { createTicket, formatTicket, type Ticket } from "@ticket-flow/shared";

export { createApp } from "./presentation/app.js";
export type { AppDependencies } from "./presentation/app.js";
export type { CreateOrganizationDependencies } from "./application/create-organization.js";
export type { RegisterUserDependencies } from "./application/register-user.js";
export type { LoginUserDependencies } from "./application/login-user.js";

import { demoUser } from "./users.js";

export type MockOrganization = Readonly<{
  id: string;
  name: string;
  ownerId: string;
}>;

export const demoOrganization: MockOrganization = {
  id: "demo-org-001",
  name: "Demo Organization",
  ownerId: demoUser.id,
};

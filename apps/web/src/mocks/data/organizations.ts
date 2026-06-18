export type MockOrganizationRole = "owner" | "admin" | "member" | "viewer";

export type MockOrganization = Readonly<{
  id: string;
  name: string;
  slug: string;
  role: MockOrganizationRole;
}>;

export const demoOrganization: MockOrganization = {
  id: "demo-org-001",
  name: "Demo Organization",
  slug: "demo-organization",
  role: "owner",
};

export type MockUser = Readonly<{
  id: string;
  email: string;
  name: string | null;
  password: string;
}>;

export const demoUser: MockUser = {
  id: "demo-user-001",
  email: "demo@example.com",
  name: "Demo User",
  password: "demo1234",
};

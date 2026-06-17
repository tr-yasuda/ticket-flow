export type MockUser = Readonly<{
  id: string;
  email: string;
  password: string;
}>;

export const demoUser: MockUser = {
  id: "demo-user-001",
  email: "demo@example.com",
  password: "demo1234",
};

export type User = Readonly<{
  email: string;
}>;

export function createUser(email: string): User {
  if (!isValidEmail(email)) {
    throw new Error("Invalid email address");
  }
  return { email };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+(?![\s\S])/.test(email);
}

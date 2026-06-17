import { randomUUID } from "node:crypto";

export type UserId = string;

export type User = Readonly<{
  id: string;
  email: string;
  passwordHash: string;
}>;

export function validateEmail(email: string): string {
  const normalizedEmail = email.toLowerCase();
  if (!isValidEmail(normalizedEmail)) {
    throw new Error("Invalid email address");
  }
  return normalizedEmail;
}

export function createUser(email: string, passwordHash: string): User {
  const normalizedEmail = validateEmail(email);
  return {
    id: randomUUID(),
    email: normalizedEmail,
    passwordHash,
  };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+(?![\s\S])/.test(email);
}

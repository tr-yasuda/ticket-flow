export type User = Readonly<{
  email: string;
}>;

export function createUser(email: string): User {
  const normalizedEmail = email.trim().toLowerCase();
  if (!isValidEmail(normalizedEmail)) {
    throw new Error("Invalid email address");
  }
  return { email: normalizedEmail };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

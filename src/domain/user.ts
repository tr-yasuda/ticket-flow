export type User = Readonly<{
  email: string;
}>;

export function createUser(email: string): User {
  const trimmedEmail = email.trim();
  if (!isValidEmail(trimmedEmail)) {
    throw new Error("Invalid email address");
  }
  return { email: trimmedEmail };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

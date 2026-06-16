import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;
const MIN_PASSWORD_BYTES = 8;
const MAX_PASSWORD_BYTES = 72;

export type PasswordValidationResult = Readonly<
  { valid: true } | { valid: false; reason: string }
>;

function isPasswordLengthValid(plainPassword: string): boolean {
  return Buffer.byteLength(plainPassword, "utf8") <= MAX_PASSWORD_BYTES;
}

function isValidBcryptHash(hashedPassword: string): boolean {
  return /^\$2[abyx]\$(0[4-9]|[12]\d|3[01])\$[./0-9A-Za-z]{53}$/.test(
    hashedPassword,
  );
}

export function validatePassword(
  plainPassword: string,
): PasswordValidationResult {
  const byteLength = Buffer.byteLength(plainPassword, "utf8");
  if (byteLength < MIN_PASSWORD_BYTES) {
    return { valid: false, reason: "Password must be at least 8 bytes" };
  }
  if (byteLength > MAX_PASSWORD_BYTES) {
    return { valid: false, reason: "Password must be 72 bytes or fewer" };
  }
  return { valid: true };
}

export async function hashPassword(plainPassword: string): Promise<string> {
  if (!isPasswordLengthValid(plainPassword)) {
    throw new Error("Password must be 72 bytes or fewer");
  }

  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export async function verifyPassword(
  plainPassword: string,
  hashedPassword: string,
): Promise<boolean> {
  if (!isPasswordLengthValid(plainPassword)) {
    return false;
  }

  if (!isValidBcryptHash(hashedPassword)) {
    return false;
  }

  return bcrypt.compare(plainPassword, hashedPassword);
}

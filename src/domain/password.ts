import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;
const MAX_PASSWORD_BYTES = 72;

function isPasswordLengthValid(plainPassword: string): boolean {
  return Buffer.byteLength(plainPassword, "utf8") <= MAX_PASSWORD_BYTES;
}

function isValidBcryptHash(hashedPassword: string): boolean {
  return /^\$2[abyx]\$\d{2}\$[./0-9A-Za-z]{53}$/.test(hashedPassword);
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

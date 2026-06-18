import { z } from "zod";

const portSchema = z
  .string()
  .default("3000")
  .refine((value) => /^[0-9]+$/.test(value.trim()), "PORT must be an integer")
  .refine((value) => {
    const port = Number.parseInt(value.trim(), 10);
    return port >= 0 && port <= 65535;
  }, "PORT must be between 0 and 65535")
  .transform((value) => Number.parseInt(value.trim(), 10));

const databaseUrlSchema = z
  .string()
  .default("file:./dev.db")
  .refine(
    (value) => /^file:.+/.test(value.trim()),
    "DATABASE_URL must be a file: URL with a path",
  )
  .transform((value) => value.trim());

const jwtSecretSchema = z
  .string()
  .refine(
    (value) => Buffer.byteLength(value.trim(), "utf8") >= 32,
    "JWT_SECRET must be at least 32 bytes",
  )
  .transform((value) => value.trim());

const expiresInSchema = z
  .string()
  .default("15m")
  .refine(
    (value) => /^[0-9]+[smhd]?$/.test(value.trim()),
    "JWT expires in must be a number with optional unit (s, m, h, d)",
  )
  .transform((value) => value.trim());

export const env = z
  .object({
    DATABASE_URL: databaseUrlSchema,
    JWT_SECRET: jwtSecretSchema,
    JWT_ACCESS_EXPIRES_IN: expiresInSchema,
    JWT_REFRESH_EXPIRES_IN: expiresInSchema,
    PORT: portSchema,
  })
  .parse(process.env);

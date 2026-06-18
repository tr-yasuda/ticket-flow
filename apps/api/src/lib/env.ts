import { z } from "zod";

const portSchema = z
  .string()
  .default("3000")
  .refine((value) => {
    const port = Number.parseInt(value, 10);
    return Number.isInteger(port) && port >= 0 && port <= 65535;
  }, "PORT must be a valid port number between 0 and 65535")
  .transform((value) => Number.parseInt(value, 10));

export const env = z
  .object({
    DATABASE_URL: z
      .string()
      .min(1)
      .regex(/^file:/, "DATABASE_URL must start with file:")
      .default("file:./dev.db"),
    JWT_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
    JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
    PORT: portSchema,
  })
  .parse(process.env);

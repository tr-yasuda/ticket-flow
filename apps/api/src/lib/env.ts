import { z } from "zod";

export const env = z
  .object({
    DATABASE_URL: z
      .string()
      .min(1)
      .regex(/^file:/, "DATABASE_URL must start with file:"),
    JWT_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
    JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
    PORT: z.string().optional(),
  })
  .parse(process.env);

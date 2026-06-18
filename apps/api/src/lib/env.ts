import { z } from "zod";

const trimmedString = z.string().trim();

const decimalIntegerString = trimmedString.regex(/^\d+$/, "must be an integer");

function optionalWhenEmpty<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    schema,
  );
}

const portSchema = optionalWhenEmpty(decimalIntegerString.default("3000"))
  .transform((value: string) => Number.parseInt(value, 10))
  .refine(
    (port) => port >= 0 && port <= 65535,
    "PORT must be between 0 and 65535",
  );

const databaseUrlSchema = optionalWhenEmpty(
  trimmedString
    .regex(/^file:.+/, "DATABASE_URL must be a file: URL with a path")
    .default("file:./dev.db"),
);

const jwtSecretSchema = trimmedString.refine(
  (value) => Buffer.byteLength(value, "utf8") >= 32,
  "JWT_SECRET must be at least 32 bytes",
);

const expiresInSchema = optionalWhenEmpty(
  trimmedString
    .regex(
      /^\d+[smhd]?$/,
      "JWT expires in must be a number with optional unit (s, m, h, d)",
    )
    .default("15m"),
).transform((value: string) => {
  const numericOnly = /^\d+$/.test(value);
  return numericOnly ? `${value}s` : value;
});

export const env = z
  .object({
    DATABASE_URL: databaseUrlSchema,
    JWT_SECRET: jwtSecretSchema,
    JWT_ACCESS_EXPIRES_IN: expiresInSchema.default("15m"),
    JWT_REFRESH_EXPIRES_IN: expiresInSchema.default("7d"),
    PORT: portSchema,
  })
  .parse(process.env);

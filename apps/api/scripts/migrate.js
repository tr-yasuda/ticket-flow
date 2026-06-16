const { execSync } = require("node:child_process");

function readConnectionString(env) {
  return env.DATABASE_URL?.trim() ?? "";
}

function parseBooleanEnv(env, name) {
  const raw = env[name];
  if (raw === undefined || raw.trim() === "") {
    return undefined;
  }
  const value = raw.trim().toLowerCase();
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new Error(`Invalid value for ${name}: ${raw}`);
}

function validateConnectionString(connectionString) {
  let parsedUrl;
  try {
    parsedUrl = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL");
  }
  if (
    !parsedUrl.href.startsWith("postgres://") &&
    !parsedUrl.href.startsWith("postgresql://")
  ) {
    throw new Error(
      `DATABASE_URL must use postgres:// or postgresql:// protocol, got: ${parsedUrl.protocol}`,
    );
  }
}

function loadDatabaseConfig(env) {
  const connectionString = readConnectionString(env);
  if (connectionString === "") {
    throw new Error("DATABASE_URL is required");
  }
  validateConnectionString(connectionString);
  return { connectionString };
}

function main() {
  const direction = process.argv[2] ?? "up";
  const args = process.argv.slice(3).join(" ");

  loadDatabaseConfig(process.env);

  const isSslEnabled = parseBooleanEnv(process.env, "DATABASE_SSL");
  const shouldRejectUnauthorized = parseBooleanEnv(
    process.env,
    "DATABASE_SSL_REJECT_UNAUTHORIZED",
  );

  const env = { ...process.env };
  if (isSslEnabled === true) {
    env.PGSSLMODE =
      shouldRejectUnauthorized === false ? "require" : "verify-full";
  } else if (isSslEnabled === false) {
    env.PGSSLMODE = "disable";
  }

  execSync(
    `node-pg-migrate ${direction} --config-file node-pg-migrate.config.json ${args}`,
    {
      stdio: "inherit",
      env,
    },
  );
}

main();

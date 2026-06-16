const { execSync } = require("node:child_process");

function readConnectionString(env) {
  return env.DATABASE_URL?.trim() ?? "";
}

function loadDatabaseConfig(env) {
  const connectionString = readConnectionString(env);
  if (connectionString === "") {
    throw new Error("DATABASE_URL is required");
  }
  return { connectionString };
}

function main() {
  const direction = process.argv[2] ?? "up";
  const args = process.argv.slice(3).join(" ");

  loadDatabaseConfig(process.env);

  execSync(
    `node-pg-migrate ${direction} --config-file node-pg-migrate.config.json ${args}`,
    {
      stdio: "inherit",
    },
  );
}

main();

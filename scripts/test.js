const { execSync } = require("node:child_process");

function main() {
  execSync("pnpm -r run test", { stdio: "inherit" });
}

main();

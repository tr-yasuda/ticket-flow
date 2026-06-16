const { execSync } = require("node:child_process");

function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--") {
    args.shift();
  }

  const quotedArgs = args.map(JSON.stringify).join(" ");

  if (quotedArgs.length > 0) {
    execSync(`pnpm exec vitest run ${quotedArgs}`, { stdio: "inherit" });
    return;
  }

  execSync("pnpm exec vitest run && pnpm -r run test", { stdio: "inherit" });
}

main();

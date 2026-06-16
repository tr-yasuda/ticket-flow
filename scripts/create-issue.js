const { readFileSync } = require("node:fs");
const { execFileSync } = require("node:child_process");
const { resolve } = require("node:path");

function parseArgs(argv) {
  const args = { labels: [] };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--title") {
      args.title = argv[++index];
    } else if (arg === "--body-file") {
      args.bodyFile = argv[++index];
    } else if (arg === "--label") {
      args.labels.push(argv[++index]);
    }
  }
  return args;
}

function stripFrontmatter(content) {
  if (!content.startsWith("---\n")) {
    return content;
  }
  const endIndex = content.indexOf("\n---\n", 4);
  if (endIndex === -1) {
    return content;
  }
  return content.slice(endIndex + 5).replace(/^\n+/, "");
}

function main() {
  const { title, bodyFile, labels } = parseArgs(process.argv.slice(2));
  if (!title || !bodyFile) {
    console.error(
      "Usage: node scripts/create-issue.js --title <title> --body-file <path> [--label <label> ...]",
    );
    process.exit(1);
  }

  const body = stripFrontmatter(readFileSync(resolve(bodyFile), "utf8"));
  const labelArgs = labels.flatMap((label) => ["--label", label]);

  execFileSync(
    "gh",
    ["issue", "create", "--title", title, "--body", body, ...labelArgs],
    { stdio: "inherit" },
  );
}

main();

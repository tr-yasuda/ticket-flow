const { readFileSync } = require("node:fs");
const { execFileSync } = require("node:child_process");
const { resolve } = require("node:path");

function consumeValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) {
    console.error(`Error: ${flag} requires a value`);
    process.exit(1);
  }
  return value;
}

function parseArgs(argv) {
  const args = { labels: [] };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--title") {
      args.title = consumeValue(argv, ++index, "--title");
    } else if (arg === "--body-file") {
      args.bodyFile = consumeValue(argv, ++index, "--body-file");
    } else if (arg === "--label") {
      args.labels.push(consumeValue(argv, ++index, "--label"));
    } else if (arg.startsWith("--")) {
      console.error(`Error: unknown option ${arg}`);
      process.exit(1);
    }
  }
  return args;
}

function stripFrontmatter(content) {
  const withoutBom =
    content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
  const match = withoutBom.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/);
  if (!match) {
    return content;
  }
  return withoutBom.slice(match[0].length).replace(/^(\r?\n)+/, "");
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

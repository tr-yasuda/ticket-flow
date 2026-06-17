const { readFileSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { execFileSync } = require("node:child_process");
const { resolve, join, isAbsolute } = require("node:path");
const { tmpdir } = require("node:os");

function consumeValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith("--")) {
    console.error(`Error: ${flag} requires a value`);
    process.exit(1);
  }
  return value;
}

function formatErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function parseArgs(argv) {
  const args = { labels: [] };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    } else if (arg === "--title") {
      args.title = consumeValue(argv, ++index, "--title");
    } else if (arg === "--body-file") {
      args.bodyFile = consumeValue(argv, ++index, "--body-file");
    } else if (arg === "--label") {
      args.labels.push(consumeValue(argv, ++index, "--label"));
    } else if (arg.startsWith("--")) {
      console.error(`Error: unknown option ${arg}`);
      process.exit(1);
    } else {
      console.error(`Error: unexpected argument ${arg}`);
      process.exit(1);
    }
  }
  return args;
}

function stripFrontmatter(content) {
  const withoutBom =
    content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;

  const lines = [];
  let currentLine = "";

  for (let index = 0; index < withoutBom.length; index++) {
    const char = withoutBom[index];
    if (char === "\n") {
      const endsWithCr = currentLine.endsWith("\r");
      lines.push({
        content: endsWithCr ? currentLine.slice(0, -1) : currentLine,
        ending: endsWithCr ? "\r\n" : "\n",
      });
      currentLine = "";
    } else {
      currentLine += char;
    }
  }

  if (currentLine !== "") {
    lines.push({ content: currentLine, ending: "" });
  }

  if (lines.length === 0 || lines[0].content !== "---") {
    return withoutBom;
  }

  let closingIndex = -1;
  for (let index = 1; index < lines.length; index++) {
    if (lines[index].content === "---") {
      closingIndex = index;
      break;
    }
  }

  if (closingIndex === -1) {
    return withoutBom;
  }

  let firstContentIndex = closingIndex + 1;
  while (
    firstContentIndex < lines.length &&
    lines[firstContentIndex].content === ""
  ) {
    firstContentIndex++;
  }

  return lines
    .slice(firstContentIndex)
    .map((line) => line.content + line.ending)
    .join("");
}

function resolveBodyFilePath(bodyFile) {
  if (isAbsolute(bodyFile)) {
    return bodyFile;
  }
  return resolve(__dirname, "..", bodyFile);
}

function main() {
  const { title, bodyFile, labels } = parseArgs(process.argv.slice(2));
  if (!title || !bodyFile) {
    console.error(
      "Usage: pnpm run create-issue -- --title <title> --body-file <path> [--label <label> ...]",
    );
    process.exit(1);
  }

  let body;
  try {
    body = stripFrontmatter(
      readFileSync(resolveBodyFilePath(bodyFile), "utf8"),
    );
  } catch (error) {
    console.error(
      `Error: failed to read body file "${bodyFile}": ${formatErrorMessage(error)}`,
    );
    process.exit(1);
  }

  const labelArgs = labels.flatMap((label) => ["--label", label]);

  try {
    const tmpDir = mkdtempSync(join(tmpdir(), "issue-body-"));
    const tmpBodyFile = join(tmpDir, "body.md");

    try {
      writeFileSync(tmpBodyFile, body, "utf8");
      execFileSync(
        "gh",
        [
          "issue",
          "create",
          "--title",
          title,
          "--body-file",
          tmpBodyFile,
          ...labelArgs,
        ],
        { stdio: "inherit" },
      );
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.error(
      `Error: failed to create issue: ${formatErrorMessage(error)}`,
    );
    process.exit(1);
  }
}

module.exports = {
  consumeValue,
  formatErrorMessage,
  parseArgs,
  resolveBodyFilePath,
  stripFrontmatter,
  main,
};

if (require.main === module) {
  main();
}

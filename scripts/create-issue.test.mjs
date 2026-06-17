import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, it, expect, vi } from "vitest";

import {
  consumeValue,
  parseArgs,
  resolveBodyFilePath,
  stripFrontmatter,
} from "./create-issue.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function captureExit(action) {
  const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new Error(`PROCESS_EXIT:${code}`);
  });
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  try {
    const result = action();
    return { type: "success", result, errors: [] };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("PROCESS_EXIT:")) {
      return {
        type: "exit",
        code: Number(error.message.slice("PROCESS_EXIT:".length)),
        errors: errorSpy.mock.calls.map((call) => call.join(" ")),
      };
    }
    throw error;
  } finally {
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  }
}

describe("consumeValue", () => {
  it("returns the value at the given index", () => {
    expect(consumeValue(["a", "b"], 1, "--flag")).toBe("b");
  });

  it("exits with an error when the value is missing", () => {
    const outcome = captureExit(() => consumeValue(["--title"], 1, "--title"));

    expect(outcome.type).toBe("exit");
    expect(outcome.code).toBe(1);
    expect(outcome.errors[0]).toContain("--title requires a value");
  });

  it("exits with an error when the value is a flag", () => {
    const outcome = captureExit(() =>
      consumeValue(["--title", "--body-file"], 1, "--title"),
    );

    expect(outcome.type).toBe("exit");
    expect(outcome.code).toBe(1);
    expect(outcome.errors[0]).toContain("--title requires a value");
  });
});

describe("parseArgs", () => {
  it("parses title, body-file, and labels", () => {
    const result = parseArgs([
      "--title",
      "タイトル",
      "--body-file",
      "body.md",
      "--label",
      "type:test",
      "--label",
      "priority:P1",
    ]);

    expect(result).toEqual({
      title: "タイトル",
      bodyFile: "body.md",
      labels: ["type:test", "priority:P1"],
    });
  });

  it("returns an empty label list when no labels are given", () => {
    const result = parseArgs(["--title", "T", "--body-file", "B"]);

    expect(result).toEqual({ title: "T", bodyFile: "B", labels: [] });
  });

  it("ignores a bare -- separator", () => {
    const result = parseArgs(["--title", "T", "--", "--body-file", "B"]);

    expect(result).toEqual({ title: "T", bodyFile: "B", labels: [] });
  });

  it("exits with an error for an unknown option", () => {
    const outcome = captureExit(() => parseArgs(["--unknown"]));

    expect(outcome.type).toBe("exit");
    expect(outcome.code).toBe(1);
    expect(outcome.errors[0]).toContain("unknown option --unknown");
  });

  it("exits with an error for an unexpected positional argument", () => {
    const outcome = captureExit(() => parseArgs(["positional"]));

    expect(outcome.type).toBe("exit");
    expect(outcome.code).toBe(1);
    expect(outcome.errors[0]).toContain("unexpected argument positional");
  });

  it("exits with an error when --title is missing a value", () => {
    const outcome = captureExit(() =>
      parseArgs(["--title", "--body-file", "B"]),
    );

    expect(outcome.type).toBe("exit");
    expect(outcome.code).toBe(1);
    expect(outcome.errors[0]).toContain("--title requires a value");
  });

  it("exits with an error when --body-file is missing a value", () => {
    const outcome = captureExit(() =>
      parseArgs(["--title", "T", "--body-file"]),
    );

    expect(outcome.type).toBe("exit");
    expect(outcome.code).toBe(1);
    expect(outcome.errors[0]).toContain("--body-file requires a value");
  });

  it("exits with an error when --label is missing a value", () => {
    const outcome = captureExit(() =>
      parseArgs(["--title", "T", "--body-file", "B", "--label"]),
    );

    expect(outcome.type).toBe("exit");
    expect(outcome.code).toBe(1);
    expect(outcome.errors[0]).toContain("--label requires a value");
  });
});

describe("stripFrontmatter", () => {
  it("removes frontmatter and returns the body", () => {
    const content = "---\nname: タスク\n---\n\n## 目的\n";

    expect(stripFrontmatter(content)).toBe("## 目的\n");
  });

  it("returns the content unchanged when there is no frontmatter", () => {
    const content = "## 目的\n";

    expect(stripFrontmatter(content)).toBe(content);
  });

  it("strips a BOM before removing frontmatter", () => {
    const content = "\uFEFF---\ntitle: x\n---\nbody\n";

    expect(stripFrontmatter(content)).toBe("body\n");
  });

  it("handles CRLF line endings in frontmatter", () => {
    const content = "---\r\ntitle: x\r\n---\r\nbody\r\n";

    expect(stripFrontmatter(content)).toBe("body\r\n");
  });

  it("handles mixed CRLF and LF line endings", () => {
    const content = "---\r\ntitle: x\n---\nbody\n";

    expect(stripFrontmatter(content)).toBe("body\n");
  });

  it("handles an empty frontmatter block", () => {
    const content = "---\n---\nbody\n";

    expect(stripFrontmatter(content)).toBe("body\n");
  });

  it("does not break when frontmatter YAML contains --- inside a value", () => {
    const content = '---\ntitle: "foo --- bar"\n---\nbody\n';

    expect(stripFrontmatter(content)).toBe("body\n");
  });

  it("does not treat --- on its own line inside a YAML literal block as the closing delimiter", () => {
    const content = "---\ndescription: |\n  ---\n  some text\n---\nbody\n";

    expect(stripFrontmatter(content)).toBe("body\n");
  });

  it("does not treat --- in the body as a frontmatter delimiter", () => {
    const content = "## 例\n\n```yaml\n---\n```\n";

    expect(stripFrontmatter(content)).toBe(content);
  });

  it("trims leading blank lines after frontmatter", () => {
    const content = "---\ntitle: x\n---\n\n\nbody\n";

    expect(stripFrontmatter(content)).toBe("body\n");
  });

  it("returns an empty string when there is only frontmatter", () => {
    const content = "---\ntitle: x\n---\n";

    expect(stripFrontmatter(content)).toBe("");
  });

  it("returns the content unchanged when the closing delimiter is missing", () => {
    const content = "---\ntitle: x\nbody\n";

    expect(stripFrontmatter(content)).toBe(content);
  });

  it("works with the issue template task.md", () => {
    const template = readFileSync(
      resolve(__dirname, "../.github/ISSUE_TEMPLATE/task.md"),
      "utf8",
    );
    const result = stripFrontmatter(template);

    expect(result.startsWith("---")).toBe(false);
    expect(result.includes("## 目的と背景")).toBe(true);
  });
});

describe("resolveBodyFilePath", () => {
  it("resolves a relative path from the project root even when cwd is a subdirectory", () => {
    const originalCwd = process.cwd();
    try {
      process.chdir(resolve(__dirname, "../apps/web"));
      const result = resolveBodyFilePath(".github/ISSUE_TEMPLATE/task.md");

      expect(result).toBe(
        resolve(__dirname, "../.github/ISSUE_TEMPLATE/task.md"),
      );
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("returns an absolute path unchanged", () => {
    const absolutePath = resolve(__dirname, "body.md");

    expect(resolveBodyFilePath(absolutePath)).toBe(absolutePath);
  });
});

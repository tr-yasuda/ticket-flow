import { describe, expect, it } from "vitest";

import { escapeLikePattern } from "../../../../src/infrastructure/database/ticket-repository.js";

describe("escapeLikePattern", () => {
  it("% をエスケープする", () => {
    expect(escapeLikePattern("50%")).toBe("50!%");
  });

  it("_ をエスケープする", () => {
    expect(escapeLikePattern("file_1")).toBe("file!_1");
  });

  it("エスケープ文字 ! 自身をエスケープする", () => {
    expect(escapeLikePattern("a!b")).toBe("a!!b");
  });

  it("複数の特殊文字を同時にエスケープする", () => {
    expect(escapeLikePattern("50%_!")).toBe("50!%!_!!");
  });

  it("特殊文字を含まない文字列はそのまま返す", () => {
    expect(escapeLikePattern("billing")).toBe("billing");
  });
});

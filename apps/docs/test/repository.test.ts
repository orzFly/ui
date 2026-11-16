import { REPOSITORY_PATHS, repositoryText } from "@orz/fixtures/repository.ts";
import { describe, expect, it } from "vitest";
import { CHANGES, STATUS } from "../src/demos/repository/changes.ts";

describe("the Repository demo's working tree", () => {
  it("holds each file the diff changes", () => {
    expect(CHANGES.size).toBeGreaterThan(0);
    for (const path of CHANGES.keys()) expect(REPOSITORY_PATHS).toContain(path);
  });

  it("reads each status off the diff", () => {
    expect(STATUS["src/retry.ts"]).toBe("added");
    expect(STATUS["src/fetch-task.ts"]).toBe("modified");
    expect(STATUS["README.md"]).toBe("modified");
  });

  // The file view shows the working tree, so every hunk's new side stands in
  // the file at the lines the hunk names.
  for (const { path, diff } of CHANGES.values()) {
    it(`has ${path} as the diff leaves it`, () => {
      const file = repositoryText(path)?.split("\n");
      expect(file, path).toBeDefined();
      const hunks = diff.split(/^(?=@@ )/m).slice(1);
      expect(hunks.length).toBeGreaterThan(0);
      for (const hunk of hunks) {
        const [header = "", ...body] = hunk.split("\n");
        const start = Number(/\+(\d+)/.exec(header)?.[1]);
        const after = body
          .filter((line) => line.startsWith(" ") || line.startsWith("+"))
          .map((line) => line.slice(1));
        expect(file?.slice(start - 1, start - 1 + after.length)).toEqual(after);
      }
    });
  }
});

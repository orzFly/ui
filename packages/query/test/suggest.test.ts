import { describe, expect, it } from "vitest";
import { didYouMean } from "../src/suggest.ts";

describe("didYouMean", () => {
  it("picks the closest candidate", () => {
    expect(didYouMean("opne", ["open", "closed"])).toBe("open");
    expect(didYouMean("closd", ["open", "closed"])).toBe("closed");
    expect(didYouMean("comments", ["body", "comment", "spec"])).toBe("comment");
  });

  it("counts a swapped pair as one edit", () => {
    expect(didYouMean("stat", ["sttae"])).toBeNull();
    expect(didYouMean("sttae", ["state"])).toBe("state");
    expect(didYouMean("lable", ["label"])).toBe("label");
  });

  it("allows max(1, floor(length / 3)) edits", () => {
    // Short values still get one edit.
    expect(didYouMean("x", ["y"])).toBe("y");
    expect(didYouMean("ab", ["xy"])).toBeNull();
    // Six characters allow two edits, not three.
    expect(didYouMean("abcdxx", ["abcdef"])).toBe("abcdef");
    expect(didYouMean("abcxxx", ["abcdef"])).toBeNull();
  });

  it("breaks ties by candidate order", () => {
    expect(didYouMean("bat", ["cat", "hat"])).toBe("cat");
    expect(didYouMean("bat", ["hat", "cat"])).toBe("hat");
  });

  it("prefers a closer later candidate over an earlier one", () => {
    expect(didYouMean("spex", ["specs", "spec"])).toBe("spec");
  });

  it("ignores case and returns the candidate's own spelling", () => {
    expect(didYouMean("OPNE", ["open"])).toBe("open");
    expect(didYouMean("in progres", ["In Progress"])).toBe("In Progress");
  });

  it("suggests nothing when nothing is close", () => {
    expect(didYouMean("label", ["open", "closed"])).toBeNull();
    expect(didYouMean("open", [])).toBeNull();
  });

  it("counts code points, not UTF-16 units", () => {
    expect(didYouMean("部署失", ["部署失败"])).toBe("部署失败");
    // One astral character is one edit, not two.
    expect(didYouMean("a🙂", ["ab"])).toBe("ab");
  });
});

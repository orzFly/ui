import { describe, expect, it } from "vitest";
import {
  canonicalValue,
  specialValue,
  type ValueSpec,
  valueVerdict,
} from "../src/values.ts";

const state: ValueSpec = {
  kind: "enum",
  values: ["open", "closed"],
  aliases: { opened: "open", done: "closed" },
};
const is: ValueSpec = {
  kind: "enum",
  values: ["body", "comment"],
  special: ["none"],
};
const assignee: ValueSpec = {
  kind: "named",
  source: "member",
  special: ["@me", "none"],
};
const harness: ValueSpec = { kind: "free", special: ["none"] };

const members = {
  options: [{ value: "alice" }, { value: "bot-one", hint: "bot" }],
};

describe("valueVerdict", () => {
  it("accepts an enum's canonical values and aliases, case-insensitively", () => {
    expect(valueVerdict(state, "open")).toBe("valid");
    expect(valueVerdict(state, "CLOSED")).toBe("valid");
    expect(valueVerdict(state, "Done")).toBe("valid");
    expect(valueVerdict(state, "opne")).toBe("invalid");
    expect(valueVerdict(state, "")).toBe("invalid");
  });

  it("ranks special above everything, case-insensitively", () => {
    expect(valueVerdict(is, "NONE")).toBe("special");
    expect(valueVerdict(assignee, "@ME", members)).toBe("special");
    expect(valueVerdict(harness, "None")).toBe("special");
  });

  it("checks a named value against an options provider", () => {
    expect(valueVerdict(assignee, "ALICE", members)).toBe("valid");
    expect(valueVerdict(assignee, "newcomer", members)).toBe("invalid");
  });

  it("calls a named value unknown while it cannot be checked", () => {
    expect(valueVerdict(assignee, "alice", { options: undefined })).toBe(
      "unknown",
    );
    expect(valueVerdict(assignee, "alice", { search: async () => [] })).toBe(
      "unknown",
    );
    expect(valueVerdict(assignee, "alice")).toBe("unknown");
  });

  it("accepts any free value", () => {
    expect(valueVerdict(harness, "claude-agent")).toBe("valid");
    expect(
      valueVerdict({ kind: "free", source: "harness" }, "x", members),
    ).toBe("valid");
  });
});

describe("canonicalValue", () => {
  it("maps canonical spellings and aliases to the canonical value", () => {
    expect(canonicalValue(state, "OPEN")).toBe("open");
    expect(canonicalValue(state, "opened")).toBe("open");
    expect(canonicalValue(state, "DONE")).toBe("closed");
  });

  it("is null outside the set and for non-enum specs", () => {
    expect(canonicalValue(state, "opne")).toBeNull();
    expect(canonicalValue(assignee, "alice")).toBeNull();
    expect(canonicalValue(harness, "x")).toBeNull();
  });

  it("does not treat a special as a member of the set", () => {
    expect(canonicalValue(is, "none")).toBeNull();
  });

  it("does not read aliases through the prototype chain", () => {
    for (const key of ["constructor", "__proto__", "hasOwnProperty"]) {
      expect(canonicalValue(state, key)).toBeNull();
      expect(valueVerdict(state, key)).toBe("invalid");
    }
  });
});

describe("specialValue", () => {
  it("returns the spec's spelling", () => {
    expect(specialValue(assignee, "@ME")).toBe("@me");
    expect(specialValue(assignee, "alice")).toBeNull();
    expect(specialValue(state, "none")).toBeNull();
  });
});

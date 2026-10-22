import { describe, expect, it } from "vitest";
import { diagnoseQuery } from "../src/diagnostics.ts";
import { defineQuerySchema, parseQuery } from "../src/query.ts";
import type { ValueProviders } from "../src/values.ts";
import { todouQualifiers, todouSchema } from "./fixtures/todou-schema.ts";

const providers: ValueProviders = {
  label: { options: [{ value: "kind:bug" }, { value: "area:web" }] },
  status: { options: undefined },
  member: { search: async () => [{ value: "alice" }] },
};

const diagnose = (q: string) =>
  diagnoseQuery(todouSchema, parseQuery(todouSchema, q), providers);

describe("diagnoseQuery", () => {
  it("reports an enum value outside its set, with a suggestion", () => {
    const q = "x -state:opne";
    expect(diagnose(q)).toEqual([
      {
        key: "state",
        value: "opne",
        start: 9,
        end: 13,
        message: '"opne" is not a state (open, closed)',
        suggestion: "open",
      },
    ]);
  });

  it("suggests nothing when nothing is close", () => {
    expect(diagnose("is:pr")).toEqual([
      expect.objectContaining({
        message: '"pr" is not an is (body, comment, spec)',
        suggestion: null,
      }),
    ]);
  });

  it("accepts aliases, specials and any case", () => {
    expect(
      diagnose("is:Issues,SPECS state:OPEN assignee:@ME harness:None"),
    ).toEqual([]);
  });

  it("reports a named value an options provider does not hold", () => {
    expect(diagnose("label:kind:bgu,area:web")).toEqual([
      {
        key: "label",
        value: "kind:bgu",
        start: 6,
        end: 14,
        message: 'no label named "kind:bgu"',
        suggestion: "kind:bug",
      },
    ]);
  });

  it("says nothing about values it cannot judge", () => {
    // `status` is still loading, `member` is a search provider, `harness`
    // and `session` are free, and without providers nothing named is known.
    expect(diagnose("status:nope assignee:nobody harness:x session:y")).toEqual(
      [],
    );
    expect(
      diagnoseQuery(todouSchema, parseQuery(todouSchema, "label:nope")),
    ).toEqual([]);
  });

  it("says nothing about a half-typed value", () => {
    expect(diagnose("state: label:,")).toEqual([]);
  });

  it("reports each expanded value and an expansion over the limit", () => {
    const schema = defineQuerySchema({ ...todouQualifiers, braces: true });
    const run = (q: string) =>
      diagnoseQuery(schema, parseQuery(schema, q), providers);
    expect(run("state:{open,shut}")).toEqual([
      {
        key: "state",
        value: "shut",
        start: 6,
        end: 17,
        message: '"shut" is not a state (open, closed)',
        suggestion: null,
      },
    ]);
    const value = "{a,b}".repeat(7);
    expect(run(`harness:${value}`)).toEqual([
      {
        key: "harness",
        value,
        start: 8,
        end: 8 + value.length,
        message: `"${value}" expands to more than 64 values`,
        suggestion: null,
      },
    ]);
  });

  it("reports too many qualifiers once, at the first one over", () => {
    const q = Array.from({ length: 18 }, (_, i) => `session:s${i}`).join(" ");
    const diagnostics = diagnose(q);
    expect(diagnostics).toHaveLength(1);
    const start = q.indexOf("session:s16");
    expect(diagnostics[0]).toEqual({
      key: "session",
      value: "session:s16",
      start,
      end: start + "session:s16".length,
      message: "18 qualifiers (at most 16)",
      suggestion: null,
    });
    expect(diagnose(q.split(" ").slice(0, 16).join(" "))).toEqual([]);
  });
});

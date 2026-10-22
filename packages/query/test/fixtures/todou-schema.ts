import { defineQuerySchema, type QuerySchema } from "../../src/query.ts";

/**
 * todou's search qualifiers at 2fca674, expressed as a schema. The ported
 * todou cases run against this, which is what proves a todou query parses
 * the same through the generic parser.
 */
export const todouQualifiers = {
  qualifiers: {
    is: {
      value: {
        kind: "enum",
        values: ["body", "comment", "spec"],
        // The plural spellings are what `--in` and `?in=` already use.
        aliases: {
          issue: "body",
          issues: "body",
          comments: "comment",
          specs: "spec",
        },
      },
    },
    state: { value: { kind: "enum", values: ["open", "closed"] } },
    status: { value: { kind: "named", source: "status" } },
    label: { value: { kind: "named", source: "label" } },
    assignee: { value: { kind: "named", source: "member", special: ["@me"] } },
    harness: { value: { kind: "free", special: ["none"] } },
    session: { value: { kind: "free" } },
    metadata: { value: { kind: "free" }, keyAliases: ["meta"] },
  },
  maxFilters: 16,
} satisfies QuerySchema;

export const todouSchema = defineQuerySchema(todouQualifiers);

export type TodouKey = keyof typeof todouQualifiers.qualifiers;

import { defineQuerySchema, type QuerySchema } from "../../src/query.ts";

/**
 * todou's search qualifiers at 2fca674, expressed as a schema, with the key
 * hints its completion shows. The ported todou cases run against this, which
 * is what proves a todou query parses the same through the generic parser.
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
      hint: "body, comment or spec",
    },
    state: {
      value: { kind: "enum", values: ["open", "closed"] },
      hint: "open or closed",
    },
    status: {
      value: { kind: "named", source: "status" },
      hint: "a status name",
    },
    label: { value: { kind: "named", source: "label" }, hint: "a label name" },
    assignee: {
      value: { kind: "named", source: "member", special: ["@me"] },
      hint: "a login, or @me",
    },
    harness: {
      value: { kind: "free", source: "harness", special: ["none"] },
      hint: "which agent wrote it",
    },
    session: {
      value: { kind: "free", source: "session" },
      hint: "which session wrote it",
    },
    metadata: {
      value: { kind: "free" },
      keyAliases: ["meta"],
      hint: "ns, ns/key or ns/key=value",
    },
  },
  maxFilters: 16,
} satisfies QuerySchema;

export const todouSchema = defineQuerySchema(todouQualifiers);

export type TodouKey = keyof typeof todouQualifiers.qualifiers;

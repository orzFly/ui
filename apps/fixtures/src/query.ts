import type { QuerySchema, ValueOption, ValueProviders } from "@orz/query";

export const QUALIFIERS = {
  is: {
    value: { kind: "enum", values: ["open", "closed"] },
    hint: "open or closed",
  },
  label: { value: { kind: "named", source: "label" }, hint: "a label name" },
  assignee: {
    value: { kind: "named", source: "member", special: ["@me"] },
    hint: "a login, or @me",
  },
} satisfies QuerySchema["qualifiers"];

const MEMBERS: readonly ValueOption[] = [
  { value: "alice", hint: "Alice" },
  { value: "bot-one", hint: "a bot" },
  { value: "claude-agent", hint: "an agent" },
  { value: "newcomer", hint: "joined this week" },
];

/** Stands in for a server round trip, slow enough to see the wait. */
const searchMembers = (prefix: string, signal: AbortSignal) =>
  new Promise<readonly ValueOption[]>((resolve, reject) => {
    const timer = setTimeout(() => {
      const lower = prefix.toLowerCase();
      resolve(MEMBERS.filter((m) => m.value.startsWith(lower)));
    }, 400);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });

export const PROVIDERS: ValueProviders = {
  label: {
    options: [
      { value: "kind:bug" },
      { value: "kind:feature" },
      { value: "area:web" },
      { value: "area:ui" },
      { value: "In Progress", hint: "has a space" },
    ],
  },
  member: { search: searchMembers },
};

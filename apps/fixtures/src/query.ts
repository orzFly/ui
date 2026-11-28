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

/** A label as an app keeps it: its name, and the tag colour its chip is drawn in. */
export type LabelOption = ValueOption & { color: string };

/** A member as an app keeps them: whose avatar the row shows, `@me` included. */
export type MemberOption = ValueOption & { login: string };

const MEMBERS: readonly MemberOption[] = [
  { value: "alice", hint: "Alice", login: "alice" },
  { value: "bot-one", hint: "a bot", login: "bot-one" },
  { value: "claude-agent", hint: "an agent", login: "claude-agent" },
  { value: "newcomer", hint: "joined this week", login: "newcomer" },
];

/** The schema's `@me`, restated with who that is: the box offers it once, in its place. */
const ME: MemberOption = { value: "@me", hint: "Alice", login: "alice" };

/** Stands in for a server round trip, slow enough to see the wait. */
const searchMembers = (prefix: string, signal: AbortSignal) =>
  new Promise<readonly MemberOption[]>((resolve, reject) => {
    const timer = setTimeout(() => {
      const lower = prefix.toLowerCase();
      resolve([ME, ...MEMBERS].filter((m) => m.value.startsWith(lower)));
    }, 400);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });

const LABELS: readonly LabelOption[] = [
  { value: "kind:bug", color: "red" },
  { value: "kind:feature", color: "green" },
  { value: "area:web", color: "blue" },
  { value: "area:ui", color: "purple" },
  { value: "In Progress", hint: "has a space", color: "yellow" },
];

export const PROVIDERS: ValueProviders = {
  label: { options: LABELS },
  member: { search: searchMembers },
};

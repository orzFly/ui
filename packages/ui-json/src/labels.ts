/** Every string a `JsonView` shows or announces. A function takes what it names. */
export interface JsonViewLabels {
  /** The toolbar's name. Default "Document". */
  toolbar: string;
  collapseAll: string;
  expandAll: string;
  copyDocument: string;
  wrap: string;
  inspectDocument: string;
  /** The search field's name and placeholder. */
  search: string;
  /** The match count while searching: "3 matches". */
  matches: (n: number) => string;
  /** A collapsed array's placeholder: "[3 items]". */
  items: (n: number) => string;
  /** A cut string's badge, given `formatChars`' text: "12.4k chars". */
  chars: (n: string) => string;
  /** A row's ⋯ button: "Actions for $.tools". */
  rowActions: (path: string) => string;
  copy: string;
  copyAsJson: string;
  copyCompact: string;
  copySource: string;
  copyPath: string;
  copyKey: string;
  inspect: string;
  expandSubtree: string;
  collapseSubtree: string;
  selectMembers: string;
  /** Copy, for a range: "Copy 2 members". */
  copyMembers: (n: number) => string;
  /** What a Copy button that answers in place says to a screen reader. */
  copied: string;
  copiedValue: string;
  copiedJson: string;
  copiedSource: string;
  copiedPath: string;
  copiedKey: string;
  copiedMembers: (n: number) => string;
  /** A copy of a value that cannot be written as JSON (a cycle, a BigInt). */
  cannotSerialise: string;
  /** The row budget's warning, given the limit as text. */
  rowBudget: (limit: string) => string;
  expandBudget: string;
  searchBudget: string;
  dismiss: string;
  inspectTitle: string;
  close: string;
  download: string;
  parseAsJson: string;
  showText: string;
  notJson: string;
}

export const DEFAULT_LABELS: JsonViewLabels = {
  toolbar: "Document",
  collapseAll: "Collapse all",
  expandAll: "Expand all",
  copyDocument: "Copy document",
  wrap: "Wrap long strings",
  inspectDocument: "Inspect document",
  search: "Search keys and values",
  matches: (n) => (n === 1 ? "1 match" : `${n} matches`),
  items: (n) => (n === 1 ? "[1 item]" : `[${n} items]`),
  chars: (n) => `${n} chars`,
  rowActions: (path) => `Actions for ${path}`,
  copy: "Copy",
  copyAsJson: "Copy as JSON",
  copyCompact: "Copy compact JSON",
  copySource: "Copy source",
  copyPath: "Copy path",
  copyKey: "Copy key",
  inspect: "Inspect",
  expandSubtree: "Expand subtree",
  collapseSubtree: "Collapse subtree",
  selectMembers: "Select members…",
  copyMembers: (n) => `Copy ${n} members`,
  copied: "Copied",
  copiedValue: "Copied the value",
  copiedJson: "Copied as JSON",
  copiedSource: "Copied the source",
  copiedPath: "Copied the path",
  copiedKey: "Copied the key",
  copiedMembers: (n) => `Copied ${n} members`,
  cannotSerialise: "This value cannot be written as JSON",
  rowBudget: (limit) =>
    `Showing the first ${limit} rows. Collapse some nodes to see the rest.`,
  expandBudget:
    "Some subtrees were left closed, to keep from drawing too many rows at once.",
  searchBudget:
    "The search stopped before the end of the document; some matches may be missing.",
  dismiss: "Dismiss",
  inspectTitle: "Inspect",
  close: "Close",
  download: "Download",
  parseAsJson: "Parse as JSON",
  showText: "Show text",
  notJson: "Not valid JSON",
};

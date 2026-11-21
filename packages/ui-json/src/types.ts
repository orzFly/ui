/** A comment in a JSONC, JSON5, YAML or TOML source. */
export interface JsonComment {
  /** As written, delimiters included: `// note`, `/* note *\/`, YAML's or TOML's `# note`. */
  text: string;
  /** A `/* … *\/` comment, rather than a `//` one; never set for YAML or TOML. */
  block: boolean;
  /** `[start, end)` in UTF-16 offsets into the document's `source`. */
  range: [number, number];
}

/** What the source says about one member of a container, or about the root. */
export interface NodeFacts {
  /** The member's value in `source`, `[start, end)`. */
  range: [number, number];
  /** The member from its key through its value; the same as `range` for an array item or the root. */
  memberRange?: [number, number];
  /** A number or string as written, where it differs from the value's own text: `0x1F`, `1e3`, `'single'`. */
  literal?: string;
  /** Comments on the lines before the member. */
  leading?: JsonComment[];
  /** A comment after the member's value on the same line, or between its key and its value. */
  trailing?: JsonComment;
  /** In a container, the comments after its last member; on the root, also those after the root value. */
  dangling?: JsonComment[];
  /** The anchor the node is named by, without `&`. */
  anchor?: string;
  /** The node's tag as written: `!!binary`, `!thing`. */
  tag?: string;
  /** Set when the member is an alias. */
  alias?: {
    /** The anchor's name, without `*`. */
    name: string;
    /** The anchored node's path in the view. */
    path: string;
    /** The alias sits inside the node it names, so the value holds itself; drawn as a leaf. */
    recursive: boolean;
  };
  /**
   * Where a member is written in more than one place, each place in source order, `[start, end)`.
   * Set only with two or more; `range` and `memberRange` then run from the first to the last.
   */
  parts?: [number, number][];
}

/**
 * A value with what its source text says about it. `facts(container, key)` reads one member's
 * facts, where `container` is the object or array that holds it, by reference; the root's are
 * `facts(null, "$")`.
 */
export interface JsonDocument {
  value: unknown;
  /** The text it was parsed from; present when parsed. */
  source?: string;
  facts?: (
    container: object | null,
    key: string | number,
  ) => NodeFacts | undefined;
}

/**
 * What is selected in a `JsonView`: a key, a value (a container with everything under it), or a
 * run of siblings under one parent. Paths are accessors: `$`, `$.messages[0].role`, `$["odd key"]`.
 */
export type JsonSelection =
  | { type: "key"; path: string }
  | { type: "value"; path: string }
  /** Siblings under one parent; `anchor` is where the range started, `focus` where it ends. */
  | { type: "members"; anchor: string; focus: string };

/** A piece of a summary's call arguments, coloured by what it is. */
export type JsonSummaryToken = {
  kind: "name" | "key" | "value" | "punct";
  text: string;
};

/** What a collapsed object's row says about it after `{…}`. */
export interface JsonSummary {
  /** Short kind labels; `emphasis` draws one in the text colour instead of the muted one. */
  tags: { key: string; text: string; emphasis?: boolean }[];
  name: string | null;
  /** A call's arguments, drawn after `name`; never set together with `text`. */
  args: JsonSummaryToken[] | null;
  /** A body snippet, drawn quoted. */
  text: string | null;
}

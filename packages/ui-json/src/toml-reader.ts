import { type AST, ParseError, parseTOML } from "toml-eslint-parser";
import { lineAndColumn, ROOT_KEY } from "./parse.ts";
import type { ParseTomlResult } from "./toml.ts";
import { onlyTrivia } from "./trivia.ts";
import type { JsonComment, JsonDocument, NodeFacts } from "./types.ts";

type Key = string | number;
type Place = [number, number];

/** A table or array of tables that headers and dotted keys write into. */
interface Open {
  value: Record<string, unknown> | unknown[];
  facts: NodeFacts;
  /** Every header section and dotted key–value that writes into it, in source order. */
  places: Place[];
  children: Map<Key, Open>;
}

/** An inline table or array, where comments are placed as JSONC places them. */
interface Inline {
  range: Place;
  facts: NodeFacts;
  members: Slot[];
}

/** A key–value or an array item, by where it stands. */
interface Slot {
  start: number;
  end: number;
  /** What a comment on its last line trails. */
  facts: NodeFacts;
  /** What comments on the lines before it lead: a dotted key's first new table, or the member. */
  lead: NodeFacts;
  inline?: Inline;
}

/** What stands at the top level of the text, in source order. */
type Entry =
  | { kind: "member"; slot: Slot }
  | {
      kind: "header";
      start: number;
      /** The end of the header's key: a comment on its line trails `row`. */
      keyEnd: number;
      /** The table the header opens: for `[[name]]`, the item. */
      row: NodeFacts;
    };

const isBreak = (c: number) => c === 0x0a || c === 0x0d;

function append(
  facts: NodeFacts,
  field: "leading" | "dangling",
  comments: JsonComment[],
) {
  if (comments.length === 0) return;
  facts[field] = [...(facts[field] ?? []), ...comments];
}

class Reader {
  private readonly text: string;
  private readonly tables = new WeakMap<object, Map<Key, NodeFacts>>();
  /** Every table and array of tables but the root, whose ranges come from their places. */
  private readonly opens: Open[] = [];

  constructor(text: string) {
    this.text = text;
  }

  read(ast: AST.TOMLProgram, start: number): JsonDocument {
    const rootFacts: NodeFacts = { range: [start, this.text.length] };
    const root: Open = {
      value: {},
      facts: rootFacts,
      places: [],
      children: new Map(),
    };
    this.tables.set(root.value, new Map());
    const entries: Entry[] = [];
    for (const node of (ast.body[0] as AST.TOMLTopLevelTable).body) {
      if (node.type === "TOMLKeyValue") {
        entries.push({ kind: "member", slot: this.keyValue(root, node) });
        continue;
      }
      const table = this.header(root, node);
      entries.push({
        kind: "header",
        start: node.range[0],
        keyEnd: node.key.range[1],
        row: table.facts,
      });
      for (const kv of node.body) {
        entries.push({ kind: "member", slot: this.keyValue(table, kv) });
      }
    }
    for (const open of this.opens) this.settle(open);
    const comments = ast.comments.map(
      (c): JsonComment => ({
        text: this.text.slice(c.range[0], c.range[1]),
        block: false,
        range: [c.range[0], c.range[1]],
      }),
    );
    this.placeTopLevel(entries, comments, rootFacts);

    const tables = this.tables;
    return {
      value: root.value,
      source: this.text,
      facts: (container, key) => {
        if (container === null) return key === ROOT_KEY ? rootFacts : undefined;
        const table = tables.get(container);
        if (!table) return undefined;
        return table.get(Array.isArray(container) ? Number(key) : key);
      },
    };
  }

  private set(
    parent: Open["value"],
    key: Key,
    value: unknown,
    facts: NodeFacts,
  ) {
    const table = this.tables.get(parent) as Map<Key, NodeFacts>;
    if (Array.isArray(parent)) {
      table.set(parent.length, facts);
      parent.push(value);
      return;
    }
    // An own property even for `__proto__`, as `parseJson` defines it.
    Object.defineProperty(parent, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    table.set(key, facts);
  }

  private open(parent: Open, key: Key, value: Open["value"]): Open {
    const open: Open = {
      value,
      facts: { range: [0, 0] },
      places: [],
      children: new Map(),
    };
    this.tables.set(value, new Map());
    this.set(parent.value, key, value, open.facts);
    parent.children.set(
      Array.isArray(parent.value) ? parent.value.length - 1 : key,
      open,
    );
    this.opens.push(open);
    return open;
  }

  /** The table or array under `key`, created as a table when it is not there yet. */
  private table(parent: Open, key: Key): Open {
    return parent.children.get(key) ?? this.open(parent, key, {});
  }

  /** Walks a header's key down from the root, writing its section into every table it passes. */
  private header(root: Open, node: AST.TOMLTable): Open {
    const place: Place = [node.range[0], node.range[1]];
    const path = node.resolvedKey;
    const walked = node.kind === "array" ? path.slice(0, -2) : path;
    let at = root;
    for (const key of walked) {
      at = this.table(at, key);
      at.places.push(place);
    }
    if (node.kind === "standard") return at;
    const name = path[path.length - 2] as string;
    const list = at.children.get(name) ?? this.open(at, name, []);
    list.places.push(place);
    const item = this.open(list, (list.value as unknown[]).length, {});
    item.places.push(place);
    return item;
  }

  private keyValue(section: Open, node: AST.TOMLKeyValue): Slot {
    const keys = node.key.keys.map((k) =>
      k.type === "TOMLBare" ? k.name : k.value,
    );
    const place: Place = [node.range[0], node.range[1]];
    let at = section;
    let created: NodeFacts | undefined;
    for (const key of keys.slice(0, -1)) {
      const existing = at.children.get(key);
      at = existing ?? this.open(at, key, {});
      if (!existing) created ??= at.facts;
      at.places.push(place);
    }
    const facts: NodeFacts = {
      range: [node.value.range[0], node.value.range[1]],
      memberRange: place,
    };
    const { value, inline } = this.content(node.value, facts);
    this.set(at.value, keys[keys.length - 1] as string, value, facts);
    return {
      start: place[0],
      end: place[1],
      facts,
      lead: created ?? facts,
      inline,
    };
  }

  private content(
    node: AST.TOMLContentNode,
    facts: NodeFacts,
  ): { value: unknown; inline?: Inline } {
    if (node.type === "TOMLInlineTable") {
      const open: Open = {
        value: {},
        facts,
        places: [],
        children: new Map(),
      };
      this.tables.set(open.value, new Map());
      const members = node.body.map((kv) => this.keyValue(open, kv));
      return {
        value: open.value,
        inline: { range: [node.range[0], node.range[1]], facts, members },
      };
    }
    if (node.type === "TOMLArray") {
      const list: unknown[] = [];
      this.tables.set(list, new Map());
      const members = node.elements.map((element): Slot => {
        const range: Place = [element.range[0], element.range[1]];
        const item: NodeFacts = { range, memberRange: range };
        const built = this.content(element, item);
        this.set(list, list.length, built.value, item);
        return {
          start: range[0],
          end: range[1],
          facts: item,
          lead: item,
          inline: built.inline,
        };
      });
      return {
        value: list,
        inline: { range: [node.range[0], node.range[1]], facts, members },
      };
    }
    return { value: this.scalar(node, facts) };
  }

  private scalar(node: AST.TOMLValue, facts: NodeFacts): unknown {
    const written = this.text.slice(node.range[0], node.range[1]);
    switch (node.kind) {
      case "string":
      case "boolean":
        return node.value;
      case "integer":
      case "float": {
        // Past the safe range an integer is the nearest number, its digits kept as written.
        const value =
          node.kind === "integer" ? Number(node.bigint) : node.value;
        if (written !== String(value)) facts.literal = written;
        return value;
      }
      default:
        // A date or time is the text as written: JSON has no type for it.
        facts.literal = written;
        return written;
    }
  }

  /** A table's range from its first place to its last; `parts` when they do not read as one. */
  private settle(open: Open) {
    const merged: Place[] = [];
    for (const [start, end] of [...open.places].sort((a, b) => a[0] - b[0])) {
      const prev = merged[merged.length - 1];
      if (prev && (start <= prev[1] || onlyTrivia(this.text, prev[1], start))) {
        prev[1] = Math.max(prev[1], end);
      } else {
        merged.push([start, end]);
      }
    }
    const first = merged[0];
    const last = merged[merged.length - 1];
    if (!first || !last) return;
    open.facts.range = [first[0], last[1]];
    open.facts.memberRange = [first[0], last[1]];
    if (merged.length > 1) open.facts.parts = merged;
  }

  private sameLine(from: number, to: number): boolean {
    for (let i = from; i < to; i++) {
      if (isBreak(this.text.charCodeAt(i))) return false;
    }
    return true;
  }

  private blankLineIn(from: number, to: number): boolean {
    let breaks = 0;
    for (let i = from; i < to; i++) {
      const c = this.text.charCodeAt(i);
      if (c === 0x0d && this.text.charCodeAt(i + 1) === 0x0a) continue;
      if (isBreak(c) && ++breaks > 1) return true;
    }
    return false;
  }

  /** A block of comments cut after its last blank line: what stands apart, then what leads `next`. */
  private splitAtBlank(
    block: JsonComment[],
    next: number,
  ): [JsonComment[], JsonComment[]] {
    let cut = 0;
    block.forEach((comment, i) => {
      const to = block[i + 1]?.range[0] ?? next;
      if (this.blankLineIn(comment.range[1], to)) cut = i + 1;
    });
    return [block.slice(0, cut), block.slice(cut)];
  }

  private placeTopLevel(
    entries: Entry[],
    comments: JsonComment[],
    root: NodeFacts,
  ) {
    let i = 0;
    let trail: NodeFacts | null = null;
    let trailEnd = 0;
    /** The table the last header opened; `null` before any header. */
    let section: NodeFacts | null = null;
    let block: JsonComment[] = [];
    const takeUntil = (pos: number) => {
      for (; i < comments.length; i++) {
        const comment = comments[i] as JsonComment;
        if (comment.range[0] >= pos) return;
        if (
          trail &&
          trail.trailing === undefined &&
          this.sameLine(trailEnd, comment.range[0])
        ) {
          trail.trailing = comment;
        } else {
          block.push(comment);
        }
      }
    };
    entries.forEach((entry, n) => {
      const start = entry.kind === "member" ? entry.slot.start : entry.start;
      takeUntil(start);
      const lead = entry.kind === "member" ? entry.slot.lead : entry.row;
      if (n === 0) {
        const [apart, leading] = this.splitAtBlank(block, start);
        append(root, "leading", apart);
        append(lead, "leading", leading);
      } else if (entry.kind === "header" && section) {
        const [apart, leading] = this.splitAtBlank(block, start);
        append(section, "dangling", apart);
        append(lead, "leading", leading);
      } else {
        append(lead, "leading", block);
      }
      block = [];
      if (entry.kind === "member") {
        if (entry.slot.inline) {
          i = this.placeInline(entry.slot.inline, comments, i);
        }
        trail = entry.slot.facts;
        trailEnd = entry.slot.end;
      } else {
        trail = entry.row;
        trailEnd = entry.keyEnd;
        section = entry.row;
      }
    });
    takeUntil(Number.POSITIVE_INFINITY);
    if (entries.length === 0) append(root, "leading", block);
    else append(section ?? root, "dangling", block);
  }

  /** JSONC's placement inside an inline table or array; returns the next comment's index. */
  private placeInline(
    inline: Inline,
    comments: JsonComment[],
    from: number,
  ): number {
    let i = from;
    // A comment after the opening bracket, on its line, trails the container's own row.
    let trail = inline.facts;
    let trailEnd = inline.range[0] + 1;
    let pending: JsonComment[] = [];
    const takeUntil = (pos: number) => {
      for (; i < comments.length; i++) {
        const comment = comments[i] as JsonComment;
        if (comment.range[0] >= pos) return;
        if (
          trail.trailing === undefined &&
          this.sameLine(trailEnd, comment.range[0])
        ) {
          trail.trailing = comment;
        } else {
          pending.push(comment);
        }
      }
    };
    for (const member of inline.members) {
      takeUntil(member.start);
      append(member.lead, "leading", pending);
      pending = [];
      if (member.inline) i = this.placeInline(member.inline, comments, i);
      trail = member.facts;
      trailEnd = member.end;
    }
    takeUntil(inline.range[1]);
    append(inline.facts, "dangling", pending);
    return i;
  }
}

/** `parseToml`'s reading, once `toml-eslint-parser` is loaded. Never throws. */
export function readToml(text: string): ParseTomlResult {
  const bom = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  try {
    // The parser takes no byte-order mark; a space in its place keeps every offset.
    const ast = parseTOML(bom ? ` ${text.slice(1)}` : text, {
      tomlVersion: "1.1.0",
    });
    return { ok: true, document: new Reader(text).read(ast, bom) };
  } catch (error) {
    const offset =
      error instanceof ParseError ? Math.min(error.index, text.length) : 0;
    return {
      ok: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
        offset,
        ...lineAndColumn(text, offset),
      },
    };
  }
}

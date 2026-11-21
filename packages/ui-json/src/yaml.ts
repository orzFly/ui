import {
  type Alias,
  Composer,
  type Document,
  isAlias,
  isMap,
  isPair,
  isScalar,
  isSeq,
  Parser,
  type Scalar,
  type Node as YamlNode,
} from "yaml";
import { type JsonParseError, lineAndColumn } from "./parse.ts";
import { childPath } from "./tree.ts";
import type { JsonComment, JsonDocument, NodeFacts } from "./types.ts";

export type ParseYamlResult =
  | { ok: true; document: JsonDocument }
  | { ok: false; error: JsonParseError };

export interface ParseYamlOptions {
  /**
   * `yaml`'s own guard against alias expansion, with its rule and its default, 100. Past it the
   * parse fails with "Excessive alias count indicates a resource exhaustion attack". -1 turns
   * it off.
   */
  maxAliasCount?: number;
}

class Failure {
  readonly message: string;
  readonly offset: number;
  constructor(message: string, offset: number) {
    this.message = message;
    this.offset = offset;
  }
}

/** A CST token with no tokens inside it, by where it stands. */
interface Leaf {
  type: string;
  offset: number;
  end: number;
}

/** CST tokens that hold others; their own `source`, if any, is not one token. */
const BRANCHES = new Set([
  "document",
  "block-map",
  "block-seq",
  "flow-collection",
  "block-scalar",
]);
const BRANCH_FIELDS = ["start", "key", "sep", "value", "items", "end", "props"];
/** What stands between a node's properties and the node, or between them. */
const BETWEEN = new Set(["space", "newline", "comment"]);

/** Every leaf token of the CST, in source order. */
function leavesOf(tokens: readonly unknown[]): Leaf[] {
  const out: Leaf[] = [];
  const stack: unknown[] = [...tokens].reverse();
  while (stack.length > 0) {
    const item = stack.pop();
    if (Array.isArray(item)) {
      for (let i = item.length - 1; i >= 0; i--) stack.push(item[i]);
      continue;
    }
    if (item === null || typeof item !== "object") continue;
    const token = item as Record<string, unknown>;
    if (
      typeof token.type === "string" &&
      typeof token.offset === "number" &&
      typeof token.source === "string" &&
      !BRANCHES.has(token.type)
    ) {
      out.push({
        type: token.type,
        offset: token.offset,
        end: token.offset + token.source.length,
      });
    }
    for (let i = BRANCH_FIELDS.length - 1; i >= 0; i--) {
      const field = token[BRANCH_FIELDS[i] as string];
      if (field !== undefined) stack.push(field);
    }
  }
  // Fields are walked in an order that is almost, not always, the source's.
  return out.sort((a, b) => a.offset - b.offset);
}

/** A member, the root, or a stream's document, by where it stands in the source. */
interface Rec {
  facts: NodeFacts;
  /** Where the member starts: its key, its key's properties, `?` or `-`. */
  start: number;
  /** Where the value starts: its first property, or the value itself. */
  valueStart: number;
  /** Where the value itself starts, after its properties. */
  bodyStart: number;
  end: number;
  parent: Rec | null;
  shape: "block" | "flow" | "leaf";
  /** A block collection's members' column. */
  col: number;
  kind: "member" | "doc" | "root";
}

interface Built {
  value: unknown;
  path: string;
  facts: NodeFacts;
}

const isLineBreak = (c: number) => c === 0x0a || c === 0x0d;

const PLAIN = "PLAIN";
const BLOCK_SCALARS = new Set(["BLOCK_LITERAL", "BLOCK_FOLDED"]);

class Reader {
  private readonly text: string;
  private readonly maxAliasCount: number;
  private readonly leaves: Leaf[];
  private readonly leafOffsets: number[];
  private readonly tables = new WeakMap<
    object,
    Map<string | number, NodeFacts>
  >();
  private readonly records: Rec[] = [];
  /** The innermost member that ends at an offset. */
  private readonly ends = new Map<number, Rec>();
  private readonly docRecs: Rec[] = [];

  // Per document.
  private targets = new Map<Alias, YamlNode | undefined>();
  private built = new Map<YamlNode, Built>();
  private counts = new Map<YamlNode, { count: number; aliasCount: number }>();
  private building = new Set<YamlNode>();
  private schemaTags: {
    tag: string;
    default?: unknown;
    test?: RegExp;
    resolve?: (...args: never[]) => unknown;
  }[] = [];
  private knownTags = new Set<string>();

  constructor(text: string, leaves: Leaf[], maxAliasCount: number) {
    this.text = text;
    this.leaves = leaves;
    this.leafOffsets = leaves.map((leaf) => leaf.offset);
    this.maxAliasCount = maxAliasCount;
  }

  private fail(message: string, offset: number): never {
    throw new Failure(message, offset);
  }

  // --- the source -----------------------------------------------------------

  /** The index of the last leaf that starts before `offset`, or -1. */
  private leafBefore(offset: number): number {
    let lo = 0;
    let hi = this.leafOffsets.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((this.leafOffsets[mid] as number) < offset) lo = mid + 1;
      else hi = mid;
    }
    return lo - 1;
  }

  /** The anchor and tag written before a node that starts at `offset`. */
  private propsBefore(
    offset: number,
  ): { start: number; end: number; tag?: string } | null {
    let start = -1;
    let end = -1;
    let tag: string | undefined;
    for (let i = this.leafBefore(offset); i >= 0; i--) {
      const leaf = this.leaves[i] as Leaf;
      if (BETWEEN.has(leaf.type)) continue;
      if (leaf.type !== "anchor" && leaf.type !== "tag") break;
      if (end < 0) end = leaf.end;
      start = leaf.offset;
      if (leaf.type === "tag") tag = this.text.slice(leaf.offset, leaf.end);
    }
    return start < 0 ? null : { start, end, tag };
  }

  /** The offset of an indicator (`?`, `-`) written before `offset`, past space and comments. */
  private indicatorBefore(offset: number, type: string): number | undefined {
    for (let i = this.leafBefore(offset); i >= 0; i--) {
      const leaf = this.leaves[i] as Leaf;
      if (BETWEEN.has(leaf.type)) continue;
      return leaf.type === type ? leaf.offset : undefined;
    }
    return undefined;
  }

  private lineStart(offset: number): number {
    let i = offset;
    while (i > 0 && !isLineBreak(this.text.charCodeAt(i - 1))) i--;
    return i;
  }

  private column(offset: number): number {
    return offset - this.lineStart(offset);
  }

  private ownLine(offset: number): boolean {
    for (let i = this.lineStart(offset); i < offset; i++) {
      const c = this.text.charCodeAt(i);
      if (c !== 0x20 && c !== 0x09 && c !== 0xfeff) return false;
    }
    return true;
  }

  /** Where a node ends: before a block scalar's last line break, and after a block collection's last member. */
  private nodeEnd(node: YamlNode | null): number {
    let current = node;
    for (;;) {
      if (!current) return 0;
      if ((isMap(current) || isSeq(current)) && isBlock(current)) {
        const last = current.items.at(-1) as unknown;
        if (last === undefined) return current.range?.[1] ?? 0;
        if (isPair(last)) {
          current = (last.value ?? last.key) as YamlNode | null;
        } else {
          current = last as YamlNode;
        }
        continue;
      }
      if (isScalar(current)) return this.scalarEnd(current);
      return current.range?.[1] ?? 0;
    }
  }

  private scalarEnd(node: Scalar): number {
    const [start, end] = node.range as [number, number, number];
    if (BLOCK_SCALARS.has(node.type ?? "")) {
      let e = end;
      while (e > start && isLineBreak(this.text.charCodeAt(e - 1))) e--;
      return e;
    }
    return end;
  }

  // --- values ---------------------------------------------------------------

  private resolvePlain(source: string): unknown {
    for (const tag of this.schemaTags) {
      if (tag.default && tag.test?.test(source) && tag.resolve) {
        return (
          tag.resolve as (s: string, e: () => void, o: object) => unknown
        )(source, () => {}, {});
      }
    }
    return source;
  }

  private scalarValue(node: Scalar): { value: unknown; literal?: string } {
    let value: unknown = node.value;
    // A tag the core schema does not know is drawn, never applied.
    if (node.tag && !this.knownTags.has(node.tag)) {
      value =
        node.type === PLAIN && typeof value === "string"
          ? this.resolvePlain(value)
          : value;
    }
    if (typeof value === "bigint") value = Number(value);
    if (
      value !== null &&
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean"
    ) {
      value = String(value);
    }
    if (typeof value === "string") return { value };
    const [start, end] = node.range as [number, number, number];
    if (start === end) return { value };
    const written = this.text.slice(start, end);
    return written === String(value) ? { value } : { value, literal: written };
  }

  private keyText(key: YamlNode | null): string {
    if (!key) return "";
    if (isScalar(key) && typeof key.value === "string") {
      if (!key.tag || this.knownTags.has(key.tag)) return key.value;
    }
    const start = key.range?.[0] ?? 0;
    return this.text
      .slice(start, this.nodeEnd(key))
      .replace(/[ \t]*(?:\r\n|\r|\n)[ \t]*/g, " ");
  }

  /** `yaml`'s count of what an alias would expand to (`getAliasCount` in its `Alias.js`). */
  private aliasCount(node: unknown): number {
    if (isAlias(node)) {
      const target = this.targets.get(node);
      const data = target && this.counts.get(target);
      return data ? data.count * data.aliasCount : 0;
    }
    if (isMap(node) || isSeq(node)) {
      let count = 0;
      for (const item of node.items) {
        const c = this.aliasCount(item);
        if (c > count) count = c;
      }
      return count;
    }
    if (isPair(node)) {
      return Math.max(this.aliasCount(node.key), this.aliasCount(node.value));
    }
    return 1;
  }

  private resolveAlias(alias: Alias): { target: YamlNode; built: Built } {
    const offset = alias.range?.[0] ?? 0;
    if (this.maxAliasCount === 0) {
      this.fail("Alias resolution is disabled", offset);
    }
    const target = this.targets.get(alias);
    const built = target && this.built.get(target);
    if (!target || !built) {
      this.fail(
        `Unresolved alias (the anchor must be set before the alias): ${alias.source}`,
        offset,
      );
    }
    const data = this.counts.get(target);
    if (this.maxAliasCount >= 0 && data) {
      data.count += 1;
      if (data.aliasCount === 0) data.aliasCount = this.aliasCount(target);
      if (data.count * data.aliasCount > this.maxAliasCount) {
        this.fail(
          "Excessive alias count indicates a resource exhaustion attack",
          offset,
        );
      }
    }
    return { target, built };
  }

  private anchored(node: YamlNode, built: Built) {
    if (!node.anchor) return;
    this.built.set(node, built);
    this.counts.set(node, { count: 1, aliasCount: 0 });
  }

  /** Anchors and aliases in a key, which is drawn as its text: an alias to one names its member. */
  private visitKey(key: YamlNode, path: string, facts: NodeFacts) {
    const stack: unknown[] = [key];
    while (stack.length > 0) {
      const node = stack.pop();
      if (isAlias(node)) {
        this.resolveAlias(node);
      } else if (isScalar(node)) {
        this.anchored(node, {
          value: this.scalarValue(node).value,
          path,
          facts,
        });
      } else if (isMap(node) || isSeq(node)) {
        this.anchored(node, {
          value: this.keyText(node),
          path,
          facts,
        });
        for (let i = node.items.length - 1; i >= 0; i--) {
          stack.push(node.items[i]);
        }
      } else if (isPair(node)) {
        stack.push(node.value, node.key);
      }
    }
  }

  /**
   * Builds one member's value and its facts. `startOf` gives the member's start from its value's
   * start; `fallback` is where an absent value stands.
   */
  private member(
    node: YamlNode | null,
    path: string,
    parent: Rec | null,
    kind: Rec["kind"],
    startOf: (valueStart: number) => number,
    fallback: number,
  ): { value: unknown; rec: Rec } {
    const facts: NodeFacts = { range: [0, 0] };
    const bodyStart = node?.range?.[0] ?? fallback;
    const props =
      node && (node.anchor || node.tag) ? this.propsBefore(bodyStart) : null;
    const valueStart = props ? Math.min(props.start, bodyStart) : bodyStart;
    const shape: Rec["shape"] =
      isMap(node) || isSeq(node) ? (isBlock(node) ? "block" : "flow") : "leaf";
    const rec: Rec = {
      facts,
      start: Math.min(startOf(valueStart), valueStart),
      valueStart,
      bodyStart,
      end: bodyStart,
      parent,
      shape,
      col: 0,
      kind,
    };
    this.records.push(rec);
    if (node?.anchor) facts.anchor = node.anchor;
    if (props?.tag !== undefined) facts.tag = props.tag;

    let value: unknown = null;
    let end = bodyStart;
    if (!node) {
      end = fallback;
    } else if (isAlias(node)) {
      const { target, built } = this.resolveAlias(node);
      value = built.value;
      facts.alias = {
        name: node.source,
        path: built.path,
        recursive: this.building.has(target),
      };
      if (built.facts.literal !== undefined) {
        facts.literal = built.facts.literal;
      }
      end = node.range?.[1] ?? bodyStart;
    } else if (isScalar(node)) {
      const scalar = this.scalarValue(node);
      value = scalar.value;
      if (scalar.literal !== undefined) facts.literal = scalar.literal;
      const [start, scalarEnd] = node.range as [number, number, number];
      // An empty value with properties ends after them.
      end = start === scalarEnd && props ? props.end : this.scalarEnd(node);
      this.anchored(node, { value, path, facts });
    } else if (isMap(node)) {
      const record: Record<string, unknown> = {};
      const table = new Map<string | number, NodeFacts>();
      value = record;
      this.anchored(node, { value, path, facts });
      this.building.add(node);
      let last: Rec | null = null;
      for (const pair of node.items) {
        const key = pair.key as YamlNode | null;
        const childValue = pair.value as YamlNode | null;
        const name = this.keyText(key);
        const memberPath = childPath(path, name, null);
        const keyBody = key?.range?.[0] ?? childValue?.range?.[0] ?? bodyStart;
        const keyProps =
          key && (key.anchor || key.tag) ? this.propsBefore(keyBody) : null;
        const keyStart = keyProps ? Math.min(keyProps.start, keyBody) : keyBody;
        const memberStart =
          this.indicatorBefore(keyStart, "explicit-key-ind") ?? keyStart;
        const child = this.member(
          childValue,
          memberPath,
          rec,
          "member",
          () => memberStart,
          key ? this.nodeEnd(key) : memberStart,
        );
        if (key) this.visitKey(key, memberPath, child.rec.facts);
        if (name === "__proto__") {
          Object.defineProperty(record, "__proto__", {
            value: child.value,
            writable: true,
            enumerable: true,
            configurable: true,
          });
        } else {
          record[name] = child.value;
        }
        table.set(name, child.rec.facts);
        last = child.rec;
        if (rec.col === 0 && node.items[0] === pair) {
          rec.col = this.column(child.rec.start);
        }
      }
      this.building.delete(node);
      this.tables.set(record, table);
      end =
        shape === "block" && last ? last.end : (node.range?.[1] ?? bodyStart);
    } else if (isSeq(node)) {
      const list: unknown[] = [];
      const table = new Map<string | number, NodeFacts>();
      value = list;
      this.anchored(node, { value, path, facts });
      this.building.add(node);
      let last: Rec | null = null;
      for (const item of node.items) {
        const child = this.member(
          item as YamlNode | null,
          `${path}[${list.length}]`,
          rec,
          "member",
          (start) => this.indicatorBefore(start, "seq-item-ind") ?? start,
          bodyStart,
        );
        table.set(list.length, child.rec.facts);
        list.push(child.value);
        if (last === null) rec.col = this.column(child.rec.start);
        last = child.rec;
      }
      this.building.delete(node);
      this.tables.set(list, table);
      end =
        shape === "block" && last ? last.end : (node.range?.[1] ?? bodyStart);
    }

    rec.end = Math.max(end, valueStart);
    facts.range = [valueStart, rec.end];
    if (kind !== "root") facts.memberRange = [rec.start, rec.end];
    if (!this.ends.has(rec.end) && kind !== "root") this.ends.set(rec.end, rec);
    return { value, rec };
  }

  /** Each alias's anchored node: the last one of its name before it, as `yaml` resolves it. */
  private findTargets(doc: Document.Parsed) {
    const last = new Map<string, YamlNode>();
    const stack: unknown[] = [doc.contents];
    while (stack.length > 0) {
      const node = stack.pop();
      if (isAlias(node)) {
        this.targets.set(node, last.get(node.source));
        continue;
      }
      if (isPair(node)) {
        stack.push(node.value, node.key);
        continue;
      }
      if (!isScalar(node) && !isMap(node) && !isSeq(node)) continue;
      if (node.anchor) last.set(node.anchor, node);
      if (isMap(node) || isSeq(node)) {
        for (let i = node.items.length - 1; i >= 0; i--) {
          stack.push(node.items[i]);
        }
      }
    }
  }

  private startDocument(doc: Document.Parsed) {
    this.targets = new Map();
    this.built = new Map();
    this.counts = new Map();
    this.building = new Set();
    const tags = (doc.schema?.tags ?? []) as Reader["schemaTags"];
    this.schemaTags = tags;
    this.knownTags = new Set(tags.map((tag) => tag.tag));
    this.findTargets(doc);
  }

  // --- the document ---------------------------------------------------------

  read(docs: Document.Parsed[], docStarts: (number | undefined)[]) {
    for (const doc of docs) {
      const error = doc.errors[0];
      if (error) {
        this.fail(error.message.split("\n")[0] as string, error.pos[0]);
      }
    }
    let rootValue: unknown;
    let rootFacts: NodeFacts;
    if (docs.length <= 1) {
      const doc = docs[0];
      if (doc) this.startDocument(doc);
      const contents = (doc?.contents ?? null) as YamlNode | null;
      const { value, rec } = this.member(
        contents,
        "$",
        null,
        "root",
        (start) => start,
        doc?.range[0] ?? 0,
      );
      rootValue = value;
      rootFacts = rec.facts;
    } else {
      const list: unknown[] = [];
      const table = new Map<string | number, NodeFacts>();
      const first = docs[0] as Document.Parsed;
      const firstStart = docStarts[0] ?? first.range[0];
      rootFacts = { range: [firstStart, firstStart] };
      const root: Rec = {
        facts: rootFacts,
        start: firstStart,
        valueStart: firstStart,
        bodyStart: firstStart,
        end: firstStart,
        parent: null,
        shape: "flow",
        col: 0,
        kind: "root",
      };
      this.records.push(root);
      docs.forEach((doc, i) => {
        this.startDocument(doc);
        const contents = doc.contents as YamlNode | null;
        const memberStart = docStarts[i] ?? doc.range[0];
        const { value, rec } = this.member(
          contents,
          `$[${i}]`,
          root,
          "doc",
          () => memberStart,
          doc.range[1],
        );
        table.set(i, rec.facts);
        list.push(value);
        this.docRecs.push(rec);
        root.end = rec.end;
      });
      rootFacts.range = [root.valueStart, root.end];
      this.tables.set(list, table);
      rootValue = list;
    }

    this.placeComments(rootFacts);

    const tables = this.tables;
    const document: JsonDocument = {
      value: rootValue,
      source: this.text,
      facts: (container, key) => {
        if (container === null) return rootFacts;
        const table = tables.get(container);
        if (!table) return undefined;
        return table.get(Array.isArray(container) ? Number(key) : key);
      },
    };
    return document;
  }

  // --- comments -------------------------------------------------------------

  private placeComments(root: NodeFacts) {
    const records = this.records
      .map((rec, i) => ({ rec, i }))
      .sort((a, b) => a.rec.start - b.rec.start || a.i - b.i)
      .map(({ rec }) => rec);
    const starts = records.map((rec) => rec.start);
    /** The index of the last record starting before (or, `inclusive`, at) `offset`. */
    const recordBefore = (offset: number, inclusive: boolean) => {
      let lo = 0;
      let hi = starts.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        const s = starts[mid] as number;
        if (s < offset || (inclusive && s === offset)) lo = mid + 1;
        else hi = mid;
      }
      return lo - 1;
    };
    const contains = (rec: Rec, offset: number) =>
      rec.start <= offset && (offset < rec.end || offset < rec.bodyStart);
    const push = (
      facts: NodeFacts,
      field: "leading" | "dangling",
      comment: JsonComment,
    ) => {
      const list = facts[field] ?? [];
      list.push(comment);
      facts[field] = list;
    };
    const lead = (rec: Rec | undefined, comment: JsonComment) => {
      if (rec) push(rec.facts, "leading", comment);
      else push(root, "dangling", comment);
    };
    const nextAfter = (offset: number) =>
      records[recordBefore(offset, true) + 1];
    const nextDoc = (offset: number) =>
      this.docRecs.find((rec) => rec.start > offset);

    const trail = (comment: JsonComment): boolean => {
      const at = comment.range[0];
      let i = this.leafBefore(at);
      while (i >= 0 && (this.leaves[i] as Leaf).type === "space") i--;
      let q = this.leaves[i];
      if (q?.type === "comma") {
        i--;
        while (i >= 0 && BETWEEN.has((this.leaves[i] as Leaf).type)) i--;
        q = this.leaves[i];
      }
      if (!q) return false;
      let rec: Rec | null | undefined = this.ends.get(q.end);
      if (!rec) {
        rec = records[recordBefore(q.offset, true)];
        while (rec && !contains(rec, q.offset)) rec = rec.parent;
      }
      if (!rec || rec.kind === "root") return false;
      // A comment on a document's `---` line is before its content.
      if (rec.kind === "doc" && q.offset < rec.valueStart) return false;
      if (rec.facts.trailing) return false;
      rec.facts.trailing = comment;
      return true;
    };

    const onItsLine = (comment: JsonComment) => {
      const at = comment.range[0];
      const col = this.column(at);
      const before = records[recordBefore(at, false)];
      if (!before) {
        const first = this.docRecs[0];
        push(first ? first.facts : root, "leading", comment);
        return;
      }
      // Up from the last member to start, through those it has finished.
      let x: Rec | null = before;
      let dangling: Rec | null = null;
      while (x && !contains(x, at)) {
        if (x.kind === "doc") {
          lead(nextDoc(at), comment);
          return;
        }
        if (!dangling && x.shape === "block" && x.col <= col) dangling = x;
        x = x.parent;
      }
      if (dangling) {
        push(dangling.facts, "dangling", comment);
        return;
      }
      if (!x) {
        push(root, "dangling", comment);
        return;
      }
      if (x.kind === "doc" && at < x.valueStart) {
        push(x.facts, "leading", comment);
        return;
      }
      if (x.kind === "root" && this.docRecs.length > 0) {
        lead(nextDoc(at), comment);
        return;
      }
      if (at < x.bodyStart && x.shape !== "block") {
        if (!x.facts.trailing) {
          x.facts.trailing = comment;
          return;
        }
      }
      const next = nextAfter(at);
      if (x.shape === "flow" && (!next || next.start >= x.end)) {
        push(x.facts, "dangling", comment);
        return;
      }
      lead(next, comment);
    };

    for (const leaf of this.leaves) {
      if (leaf.type !== "comment") continue;
      const comment: JsonComment = {
        text: this.text.slice(leaf.offset, leaf.end),
        block: false,
        range: [leaf.offset, leaf.end],
      };
      if (!this.ownLine(leaf.offset) && trail(comment)) continue;
      onItsLine(comment);
    }
  }
}

function isBlock(node: YamlNode): boolean {
  const type = (node as { srcToken?: { type?: string } }).srcToken?.type;
  return type === "block-map" || type === "block-seq";
}

/**
 * Parses YAML text (one document or a stream) into a `JsonDocument`: the value, the text, and
 * each member's range, literal, comments, anchor, tag and alias. Never throws.
 */
export function parseYaml(
  text: string,
  options: ParseYamlOptions = {},
): ParseYamlResult {
  try {
    const tokens = [...new Parser().parse(text)];
    const composer = new Composer({
      schema: "core",
      uniqueKeys: false,
      keepSourceTokens: true,
      // `!!binary` and the other YAML 1.1 tags are drawn, never applied.
      resolveKnownTags: false,
    });
    const docs = [
      ...composer.compose(tokens, true, text.length),
    ] as Document.Parsed[];
    // A document's first directive, or its `---`, where its item starts in a stream.
    const docStarts: (number | undefined)[] = [];
    let directive: number | undefined;
    for (const token of tokens) {
      if (token.type === "directive") directive ??= token.offset;
      if (token.type === "document") {
        docStarts.push(directive);
        directive = undefined;
      }
    }
    const reader = new Reader(
      text,
      leavesOf(tokens),
      options.maxAliasCount ?? 100,
    );
    return {
      ok: true,
      document: reader.read(
        docs,
        docStarts.length === docs.length ? docStarts : [],
      ),
    };
  } catch (error) {
    const failure =
      error instanceof Failure
        ? error
        : new Failure(
            error instanceof Error ? error.message : String(error),
            text.length,
          );
    const offset = Math.min(failure.offset, text.length);
    return {
      ok: false,
      error: {
        message: failure.message,
        offset,
        ...lineAndColumn(text, offset),
      },
    };
  }
}

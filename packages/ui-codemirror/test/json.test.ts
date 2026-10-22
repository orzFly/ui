import { highlightingFor, syntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { getStyleTags } from "@lezer/highlight";
import { describe, expect, it } from "vitest";
import { jsonSupport } from "../src/extensions/json.ts";

describe("jsonSupport", () => {
  it("parses JSON and colours a property name", () => {
    const state = EditorState.create({
      doc: '{"a": 1}',
      extensions: jsonSupport,
    });
    const node = syntaxTree(state).resolveInner(2, 1);
    expect(node.name).toBe("PropertyName");
    // The node's own tags, so a parser and a HighlightStyle that stop
    // agreeing on what a property name is fail here.
    const styleTags = getStyleTags(node)?.tags ?? [];
    expect(highlightingFor(state, styleTags)).toMatch(/\S/);
  });
});

import { highlightingFor, syntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { tags } from "@lezer/highlight";
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
    expect(highlightingFor(state, [tags.propertyName])).toMatch(/\S/);
  });
});

import { describe, expect, it } from "vitest";
import { diagramType } from "../src/lib/diagram-type.ts";

describe("diagramType", () => {
  it.each([
    ["flowchart LR\n  A --> B", "flowchart"],
    ["graph TD\n  A --> B", "graph"],
    ["sequenceDiagram\n  A->>B: hi", "sequenceDiagram"],
    ["stateDiagram-v2\n  [*] --> Idle", "stateDiagram-v2"],
  ])("is the keyword %j opens with", (text, type) => {
    expect(diagramType(text)).toBe(type);
  });

  it("skips the frontmatter", () => {
    expect(
      diagramType(
        "---\ntitle: Review\nconfig:\n  look: handDrawn\n---\nflowchart LR\n  A",
      ),
    ).toBe("flowchart");
  });

  it("skips a directive on one line, and one across lines", () => {
    expect(
      diagramType(
        '%%{init: {"theme": "dark"}}%%\nsequenceDiagram\n  A->>B: hi',
      ),
    ).toBe("sequenceDiagram");
    expect(
      diagramType(
        '%%{\n  init: {\n    "theme": "forest"\n  }\n}%%\ngraph LR\n  A --> B',
      ),
    ).toBe("graph");
  });

  it("skips comments and blank lines before the keyword", () => {
    expect(
      diagramType("\n%% the review flow\n\n  classDiagram\n  A <|-- B"),
    ).toBe("classDiagram");
  });

  it("is undefined when no keyword opens the source", () => {
    expect(diagramType("")).toBeUndefined();
    expect(diagramType("%% only a comment\n\n")).toBeUndefined();
    expect(diagramType("---\ntitle: x\n---\n")).toBeUndefined();
    expect(diagramType("--> nothing")).toBeUndefined();
  });
});

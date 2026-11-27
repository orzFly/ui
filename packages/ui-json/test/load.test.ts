import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.doUnmock("yaml");
  vi.doUnmock("toml-eslint-parser");
  vi.resetModules();
});

describe("parseYaml", () => {
  it("resolves to the document, or to the error and its place", async () => {
    const { parseYaml } = await import("../src/yaml.ts");
    const parsed = await parseYaml("a: 1 # one\n");
    expect(parsed.ok && parsed.document.value).toEqual({ a: 1 });
    const failed = await parseYaml("a: 1\n b: 2\n");
    expect(failed.ok || failed.error).toMatchObject({ line: 1, column: 4 });
  });

  it("rejects when yaml does not load, and loads it again on the next call", async () => {
    let fail = true;
    vi.doMock("yaml", async (importOriginal) => {
      if (fail) throw new Error("chunk failed");
      return importOriginal();
    });
    const { parseYaml } = await import("../src/yaml.ts");
    await expect(parseYaml("a: 1\n")).rejects.toThrow();
    fail = false;
    // vitest's registry keeps the failed module; a browser refetches the chunk.
    vi.resetModules();
    const parsed = await parseYaml("a: 1\n");
    expect(parsed.ok && parsed.document.value).toEqual({ a: 1 });
  });
});

describe("parseToml", () => {
  it("resolves to the document, or to the error and its place", async () => {
    const { parseToml } = await import("../src/toml.ts");
    const parsed = await parseToml('[package]\nname = "x"\n');
    expect(parsed.ok && parsed.document.value).toEqual({
      package: { name: "x" },
    });
    const failed = await parseToml("a = 1\na = 2\n");
    expect(failed.ok || failed.error).toMatchObject({ line: 2, column: 1 });
  });

  it("rejects when toml-eslint-parser does not load, and loads it again on the next call", async () => {
    let fail = true;
    vi.doMock("toml-eslint-parser", async (importOriginal) => {
      if (fail) throw new Error("chunk failed");
      return importOriginal();
    });
    const { parseToml } = await import("../src/toml.ts");
    await expect(parseToml("a = 1\n")).rejects.toThrow();
    fail = false;
    vi.resetModules();
    const parsed = await parseToml("a = 1\n");
    expect(parsed.ok && parsed.document.value).toEqual({ a: 1 });
  });
});

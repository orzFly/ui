import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Content,
  type ContentRenderer,
  ContentRenderers,
  type ContentSource,
  useContentDepth,
  useContentDisplay,
  useContentMaxDepth,
  useSourceText,
} from "../src/index.ts";

const inline = (text: string, lang?: string): ContentSource => ({
  kind: "inline",
  text,
  lang,
});

function toy(
  name: string,
  accepts: ContentRenderer["accepts"],
  extra: Partial<ContentRenderer> = {},
): ContentRenderer {
  return {
    name,
    accepts,
    Component: ({ source, className }) => (
      <span data-renderer={name} className={className}>
        {source.kind === "inline" ? source.text : source.name}
      </span>
    ),
    ...extra,
  };
}

const anyInline = toy("any", (source) => source.kind === "inline");
const shout = toy(
  "shout",
  (source) => source.kind === "inline" && source.lang === "shout",
);

describe("dispatch", () => {
  it("draws with the first renderer that accepts", () => {
    const { container } = render(
      <ContentRenderers renderers={[shout, anyInline]}>
        <Content source={inline("hi", "shout")} placement="document" />
        <Content source={inline("lo")} placement="document" />
      </ContentRenderers>,
    );
    const drawn = [...container.querySelectorAll("[data-renderer]")].map((el) =>
      el.getAttribute("data-renderer"),
    );
    expect(drawn).toEqual(["shout", "any"]);
  });

  it("puts a nested provider's renderers in front of the outer ones", () => {
    const local = toy("local", () => true);
    const { container } = render(
      <ContentRenderers renderers={[anyInline]}>
        <ContentRenderers renderers={[local]}>
          <Content source={inline("x")} placement="document" />
        </ContentRenderers>
      </ContentRenderers>,
    );
    expect(
      container.querySelector("[data-renderer]")?.getAttribute("data-renderer"),
    ).toBe("local");
  });

  it("falls back to <pre><code> for inline text with nothing registered", () => {
    const { container } = render(
      <Content source={inline("let a = 1;", "ts")} placement="document" />,
    );
    const code = container.querySelector("pre > code");
    expect(code?.textContent).toBe("let a = 1;");
    expect(code?.className).toBe("language-ts");
  });

  it("falls back to a download link for a file, or its name without a url", () => {
    const { container } = render(
      <>
        <Content
          source={{ kind: "file", name: "a.zip", url: "/files/a.zip" }}
          placement="viewer"
        />
        <Content source={{ kind: "file", name: "b.zip" }} placement="viewer" />
      </>,
    );
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/files/a.zip");
    expect(link?.textContent).toBe("a.zip");
    expect(container.querySelector("span")?.textContent).toBe("b.zip");
  });

  it("passes className to the renderer and to the fallback", () => {
    const { container } = render(
      <ContentRenderers renderers={[anyInline]}>
        <Content source={inline("x")} placement="document" className="mark" />
        <Content
          source={{ kind: "file", name: "f.bin", url: "/f" }}
          placement="document"
          className="mark"
        />
      </ContentRenderers>,
    );
    expect(container.querySelector("[data-renderer].mark")).not.toBeNull();
    expect(container.querySelector("a.mark")).not.toBeNull();
  });
});

describe("Next", () => {
  it("continues the walk with the renderers after this one", () => {
    const frame = toy("frame", () => true, {
      Component: ({ Next, ...props }) => (
        <div data-frame="">
          <Next {...props} />
        </div>
      ),
    });
    const { container } = render(
      <ContentRenderers renderers={[frame, anyInline]}>
        <Content source={inline("inside")} placement="document" />
      </ContentRenderers>,
    );
    expect(
      container.querySelector("[data-frame] > [data-renderer='any']")
        ?.textContent,
    ).toBe("inside");
  });

  it("ends at the fallback, inline and file alike", () => {
    const frame = toy("frame", () => true, {
      Component: ({ Next, ...props }) => (
        <div data-frame="">
          <Next {...props} />
        </div>
      ),
    });
    const { container } = render(
      <ContentRenderers renderers={[frame]}>
        <Content source={inline("raw")} placement="document" />
        <Content
          source={{ kind: "file", name: "x.bin", url: "/x" }}
          placement="document"
        />
      </ContentRenderers>,
    );
    expect(
      container.querySelector("[data-frame] > pre > code")?.textContent,
    ).toBe("raw");
    expect(container.querySelector("[data-frame] > a")?.textContent).toBe(
      "x.bin",
    );
  });
});

describe("useContentDisplay", () => {
  function Probe({ source }: { source: ContentSource }) {
    return <output>{String(useContentDisplay(source, "document"))}</output>;
  }

  it("reports the accepting renderer's display, block by default, or null", () => {
    const image = toy("image", (source) => source.kind === "file", {
      display: "inline",
    });
    render(
      <ContentRenderers renderers={[shout, image]}>
        <Probe source={inline("a", "shout")} />
        <Probe source={{ kind: "file", name: "a.png" }} />
        <Probe source={inline("b")} />
      </ContentRenderers>,
    );
    expect(screen.getAllByRole("status").map((el) => el.textContent)).toEqual([
      "block",
      "inline",
      "null",
    ]);
  });
});

describe("depth", () => {
  function Depth() {
    return <output>{useContentDepth()}</output>;
  }
  const nest: ContentRenderer = {
    name: "nest",
    accepts: (source) => source.kind === "file",
    Component: ({ source }) => (
      <div data-name={source.kind === "file" ? source.name : ""}>
        <Depth />
        {source.kind === "file" && source.name === "outer" ? (
          <>
            <Content
              source={{ kind: "file", name: "inner" }}
              placement="document"
            />
            <Content source={inline("fence")} placement="document" />
          </>
        ) : null}
      </div>
    ),
  };
  const passthrough: ContentRenderer = {
    name: "frame",
    accepts: (source) => source.kind === "file",
    Component: ({ Next, ...props }) => <Next {...props} />,
  };
  const inlineDepth: ContentRenderer = {
    name: "inline-depth",
    accepts: (source) => source.kind === "inline",
    Component: () => (
      <span data-inline="">
        <Depth />
      </span>
    ),
  };

  it("rises only under file sources, once per <Content>", () => {
    const { container } = render(
      <ContentRenderers renderers={[passthrough, nest, inlineDepth]}>
        <Depth />
        <Content
          source={{ kind: "file", name: "outer" }}
          placement="document"
        />
      </ContentRenderers>,
    );
    const depthOf = (selector: string) =>
      container.querySelector(`${selector} > output`)?.textContent;
    expect(container.querySelector("output")?.textContent).toBe("0");
    expect(depthOf("[data-name='outer']")).toBe("1");
    expect(depthOf("[data-name='inner']")).toBe("2");
    expect(depthOf("[data-inline]")).toBe("1");
  });

  it("does not rise under a file only the fallback draws", () => {
    const fileFallback: ContentRenderer = {
      name: "fallback-probe",
      accepts: () => false,
      Component: () => null,
    };
    function Wrap() {
      return (
        <>
          <Content source={{ kind: "file", name: "x" }} placement="document" />
          <Depth />
        </>
      );
    }
    render(
      <ContentRenderers renderers={[fileFallback]}>
        <Wrap />
      </ContentRenderers>,
    );
    expect(screen.getByRole("status").textContent).toBe("0");
  });

  it("carries maxDepth for renderers to read, inner provider first", () => {
    function Max() {
      return <output>{String(useContentMaxDepth())}</output>;
    }
    render(
      <>
        <Max />
        <ContentRenderers renderers={[]} maxDepth={3}>
          <Max />
          <ContentRenderers renderers={[]}>
            <Max />
          </ContentRenderers>
          <ContentRenderers renderers={[]} maxDepth={5}>
            <Max />
          </ContentRenderers>
        </ContentRenderers>
      </>,
    );
    expect(screen.getAllByRole("status").map((el) => el.textContent)).toEqual([
      "undefined",
      "3",
      "3",
      "5",
    ]);
  });
});

describe("identity", () => {
  it("keeps a renderer's DOM across re-renders with the same renderers", () => {
    const frame: ContentRenderer = {
      name: "frame",
      accepts: () => true,
      Component: ({ Next, ...props }) => (
        <div data-frame="">
          <Next {...props} />
        </div>
      ),
    };
    const renderers = [frame, anyInline];
    const tree = (label: string) => (
      <ContentRenderers renderers={renderers}>
        <p>{label}</p>
        <Content source={inline("stable")} placement="document" />
      </ContentRenderers>
    );
    const { container, rerender } = render(tree("one"));
    const before = container.querySelector("[data-renderer]")?.firstChild;
    rerender(tree("two"));
    const after = container.querySelector("[data-renderer]")?.firstChild;
    expect(after).toBeDefined();
    expect(after).toBe(before);
  });
});

describe("useSourceText", () => {
  type Result = ReturnType<typeof useSourceText>;
  let latest: Result | undefined;
  function Text({ source }: { source: ContentSource }) {
    latest = useSourceText(source);
    return null;
  }

  function deferred() {
    let resolve!: (text: string) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<string>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  afterEach(() => {
    latest = undefined;
    vi.unstubAllGlobals();
  });

  it("returns inline text at once", () => {
    render(<Text source={inline("now")} />);
    expect(latest?.status).toBe("ready");
    expect(latest?.text).toBe("now");
  });

  it("uses load, and reports loading until it settles", async () => {
    const pending = deferred();
    const load = vi.fn(() => pending.promise);
    render(<Text source={{ kind: "file", name: "a.md", load }} />);
    expect(latest?.status).toBe("loading");
    await act(async () => pending.resolve("# a"));
    expect(latest?.status).toBe("ready");
    expect(latest?.text).toBe("# a");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("fetches url when there is no load", async () => {
    const fetch = vi.fn(async () => new Response("from url"));
    vi.stubGlobal("fetch", fetch);
    render(<Text source={{ kind: "file", name: "a.md", url: "/a.md" }} />);
    await act(async () => {});
    expect(latest?.text).toBe("from url");
    expect(fetch).toHaveBeenCalledWith(
      "/a.md",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("reports a failed fetch as an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 404 })),
    );
    render(<Text source={{ kind: "file", name: "a.md", url: "/a.md" }} />);
    await act(async () => {});
    expect(latest?.status).toBe("error");
    expect(latest?.error?.message).toContain("404");
  });

  it("reports a file with nothing to load as an error", async () => {
    render(<Text source={{ kind: "file", name: "a.md" }} />);
    await act(async () => {});
    expect(latest?.status).toBe("error");
  });

  it("aborts on unmount, and does not report the abort", async () => {
    const pending = deferred();
    let signal: AbortSignal | undefined;
    const load = (s: AbortSignal) => {
      signal = s;
      return pending.promise;
    };
    const { unmount } = render(
      <Text source={{ kind: "file", name: "a.md", load }} />,
    );
    unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => pending.reject(new DOMException("", "AbortError")));
  });

  it("aborts on source change and reports only the new source", async () => {
    const first = deferred();
    const second = deferred();
    let firstSignal: AbortSignal | undefined;
    const loadA = (s: AbortSignal) => {
      firstSignal = s;
      return first.promise;
    };
    const loadB = () => second.promise;
    const { rerender } = render(
      <Text source={{ kind: "file", name: "a.md", load: loadA }} />,
    );
    rerender(<Text source={{ kind: "file", name: "b.md", load: loadB }} />);
    expect(firstSignal?.aborted).toBe(true);
    await act(async () => first.resolve("stale"));
    expect(latest?.status).toBe("loading");
    await act(async () => second.resolve("fresh"));
    expect(latest?.text).toBe("fresh");
  });

  it("does not restart a url load when only the load closure is new", async () => {
    const load = vi.fn(async () => "x");
    const { rerender } = render(
      <Text source={{ kind: "file", name: "a.md", url: "/a", load }} />,
    );
    await act(async () => {});
    rerender(
      <Text
        source={{ kind: "file", name: "a.md", url: "/a", load: () => load() }}
      />,
    );
    await act(async () => {});
    expect(load).toHaveBeenCalledTimes(1);
    expect(latest?.text).toBe("x");
  });

  it("reports a load that throws before returning a promise as an error", async () => {
    const load = () => {
      throw new Error("bad address");
    };
    render(<Text source={{ kind: "file", name: "a.md", load }} />);
    await act(async () => {});
    expect(latest?.status).toBe("error");
    expect(latest?.error?.message).toBe("bad address");
  });

  it("re-runs a failed load on retry()", async () => {
    let calls = 0;
    const load = async () => {
      calls++;
      if (calls === 1) throw new Error("offline");
      return "back";
    };
    render(<Text source={{ kind: "file", name: "a.md", load }} />);
    await act(async () => {});
    expect(latest?.status).toBe("error");
    expect(latest?.error?.message).toBe("offline");
    await act(async () => latest?.retry());
    expect(latest?.status).toBe("ready");
    expect(latest?.text).toBe("back");
  });

  it("drives a renderer's Retry button", async () => {
    let fail = true;
    const load = async () => {
      if (fail) throw new Error("offline");
      return "ok";
    };
    function Retrying({ source }: { source: ContentSource }) {
      const text = useSourceText(source);
      if (text.status === "error") {
        return (
          <button type="button" onClick={text.retry}>
            Retry
          </button>
        );
      }
      return <output>{text.text ?? "…"}</output>;
    }
    render(<Retrying source={{ kind: "file", name: "a.md", load }} />);
    await act(async () => {});
    fail = false;
    await act(async () => fireEvent.click(screen.getByText("Retry")));
    expect(screen.getByRole("status").textContent).toBe("ok");
  });
});

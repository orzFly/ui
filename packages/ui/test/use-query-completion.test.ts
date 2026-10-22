import type { ValueOption, ValueProviders } from "@orz/query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { todouSchema } from "../../query/test/fixtures/todou-schema.ts";
import { useQueryCompletion } from "../src/hooks/use-query-completion.ts";

type Props = { value: string; providers: ValueProviders; enabled?: boolean };

function mount(initial: Props) {
  return renderHook(
    ({ value, providers, enabled }: Props) =>
      useQueryCompletion({
        schema: todouSchema,
        value,
        caret: value.length,
        providers,
        ...(enabled === undefined ? {} : { enabled }),
      }),
    { initialProps: initial },
  );
}

const texts = (result: { current: ReturnType<typeof useQueryCompletion> }) =>
  result.current.completions.flatMap((c) => c.rows.map((r) => r.text));

/** A `search` provider whose calls the test answers by hand. */
function searchProvider() {
  const calls: {
    prefix: string;
    signal: AbortSignal;
    resolve: (rows: readonly ValueOption[]) => void;
    reject: (error: unknown) => void;
  }[] = [];
  const search = vi.fn(
    (prefix: string, signal: AbortSignal) =>
      new Promise<readonly ValueOption[]>((resolve, reject) => {
        calls.push({ prefix, signal, resolve, reject });
      }),
  );
  return { provider: { search }, search, calls };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useQueryCompletion", () => {
  it("offers a snapshot provider's rows at once", () => {
    const { result } = mount({
      value: "label:k",
      providers: {
        label: { options: [{ value: "area:web" }, { value: "kind:bug" }] },
      },
    });
    expect(texts(result)).toEqual(["kind:bug"]);
    expect(result.current.loading).toBe(false);
    expect(result.current.parts.map((p) => p.kind)).toEqual(["filter"]);
  });

  it("offers keys while a word is typed", () => {
    const { result } = mount({ value: "har", providers: {} });
    expect(texts(result)).toEqual(["harness:"]);
    expect(result.current.completions[0]?.matched).toBe(true);
  });

  it("asks a search provider after 150 ms of quiet", async () => {
    const { provider, search, calls } = searchProvider();
    const { result } = mount({
      value: "assignee:al",
      providers: { member: provider },
    });
    // `@me` is the schema's own and needs no request; it is not a prefix of
    // `al`, so nothing is offered until the answer arrives.
    expect(texts(result)).toEqual([]);
    expect(result.current.loading).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(149));
    expect(search).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(search).toHaveBeenCalledTimes(1);
    expect(calls[0]?.prefix).toBe("al");

    await act(async () => calls[0]?.resolve([{ value: "alice", hint: "A" }]));
    expect(texts(result)).toEqual(["alice"]);
    expect(result.current.loading).toBe(false);
  });

  it("aborts the previous request when the prefix moves on", async () => {
    const { provider, search, calls } = searchProvider();
    const providers = { member: provider };
    const { result, rerender } = mount({ value: "assignee:a", providers });
    await act(() => vi.advanceTimersByTimeAsync(150));
    expect(calls).toHaveLength(1);

    rerender({ value: "assignee:al", providers });
    expect(calls[0]?.signal.aborted).toBe(true);
    // An answer for the old prefix lands after all, and is not shown.
    await act(async () => calls[0]?.resolve([{ value: "admin" }]));
    expect(texts(result)).toEqual([]);

    await act(() => vi.advanceTimersByTimeAsync(150));
    expect(search).toHaveBeenCalledTimes(2);
    await act(async () => calls[1]?.resolve([{ value: "alice" }]));
    expect(texts(result)).toEqual(["alice"]);
  });

  it("does not ask while the reader is still typing", async () => {
    const { provider, search } = searchProvider();
    const providers = { member: provider };
    const { rerender } = mount({ value: "assignee:a", providers });
    await act(() => vi.advanceTimersByTimeAsync(100));
    rerender({ value: "assignee:al", providers });
    await act(() => vi.advanceTimersByTimeAsync(100));
    rerender({ value: "assignee:ali", providers });
    await act(() => vi.advanceTimersByTimeAsync(150));
    expect(search).toHaveBeenCalledTimes(1);
    expect(search.mock.calls[0]?.[0]).toBe("ali");
  });

  it("keeps each prefix's answer and asks for it only once", async () => {
    const { provider, search, calls } = searchProvider();
    const providers = { member: provider };
    const { result, rerender } = mount({ value: "assignee:a", providers });
    await act(() => vi.advanceTimersByTimeAsync(150));
    await act(async () => calls[0]?.resolve([{ value: "alice" }]));

    rerender({ value: "assignee:al", providers });
    await act(() => vi.advanceTimersByTimeAsync(150));
    await act(async () => calls[1]?.resolve([{ value: "alice" }]));

    rerender({ value: "assignee:a", providers });
    expect(texts(result)).toEqual(["alice"]);
    expect(result.current.loading).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(search).toHaveBeenCalledTimes(2);
  });

  it("offers no fetched rows when the search fails", async () => {
    const { provider, calls } = searchProvider();
    const { result } = mount({
      value: "assignee:",
      providers: { member: provider },
    });
    // The schema's own `@me` is offered while the request is out.
    expect(texts(result)).toEqual(["@me"]);
    await act(() => vi.advanceTimersByTimeAsync(150));
    await act(async () => calls[0]?.reject(new Error("offline")));
    expect(texts(result)).toEqual(["@me"]);
    expect(result.current.loading).toBe(false);
  });

  it("gives no rows for a failed search with nothing of its own to offer", async () => {
    const { provider, calls } = searchProvider();
    const { result } = mount({
      value: "label:x",
      providers: { label: provider },
    });
    await act(() => vi.advanceTimersByTimeAsync(150));
    await act(async () => calls[0]?.reject(new Error("offline")));
    expect(texts(result)).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("computes and fetches nothing while disabled", async () => {
    const { provider, search } = searchProvider();
    const { result } = mount({
      value: "assignee:al",
      providers: { member: provider },
      enabled: false,
    });
    expect(result.current.completions).toEqual([]);
    expect(result.current.loading).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(search).not.toHaveBeenCalled();
  });

  it("does not restart the quiet period when the providers object is rebuilt", async () => {
    const { provider, search } = searchProvider();
    const { rerender } = mount({
      value: "assignee:al",
      providers: { member: provider },
    });
    await act(() => vi.advanceTimersByTimeAsync(100));
    rerender({ value: "assignee:al", providers: { member: provider } });
    await act(() => vi.advanceTimersByTimeAsync(50));
    expect(search).toHaveBeenCalledTimes(1);
  });
});

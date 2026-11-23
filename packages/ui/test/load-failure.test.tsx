import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  LoadFailure,
  RefreshFailure,
} from "../src/components/load-failure.tsx";

describe("LoadFailure", () => {
  it("retries exactly once per click", () => {
    const onRetry = vi.fn();
    render(
      <LoadFailure
        message="Failed."
        detail="boom"
        onRetry={onRetry}
        retrying={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("disables the button while retrying", () => {
    const onRetry = vi.fn();
    render(
      <LoadFailure
        message="Failed."
        detail="boom"
        onRetry={onRetry}
        retrying={true}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("puts the raw error on the message line's title, not the button's", () => {
    render(
      <LoadFailure
        message="Failed."
        detail="500 Internal"
        onRetry={() => {}}
        retrying={false}
      />,
    );
    const line = screen.getByText("Failed.");
    expect(line.getAttribute("title")).toBe("500 Internal");
    expect(
      screen.getByRole("button", { name: "Retry" }).getAttribute("title"),
    ).toBeNull();
  });

  it("centres the button on touch, where its hit area leaves it no baseline", () => {
    render(
      <LoadFailure
        message="Failed."
        detail="boom"
        onRetry={() => {}}
        retrying={false}
      />,
    );
    expect(screen.getByRole("status").className.split(/\s+/)).toEqual(
      expect.arrayContaining(["items-baseline", "touch:items-center"]),
    );
    expect(
      screen.getByRole("button", { name: "Retry" }).className.split(/\s+/),
    ).toContain("touch:hit-area");
  });
});

describe("LoadFailure with an orientation", () => {
  it("draws an EmptyState in the destructive tone, the detail shown beneath the message", () => {
    render(
      <LoadFailure
        orientation="vertical"
        message="Couldn't load your notes."
        detail="503 Service Unavailable"
        onRetry={() => {}}
        retrying={false}
      />,
    );
    const state = screen.getByRole("status");
    expect(state.dataset.slot).toBe("empty-state");
    expect(state.dataset.tone).toBe("destructive");
    expect(state.dataset.orientation).toBe("vertical");
    expect(screen.getByText("Couldn't load your notes.").dataset.slot).toBe(
      "empty-state-title",
    );
    expect(screen.getByText("503 Service Unavailable").dataset.slot).toBe(
      "empty-state-description",
    );
  });

  it("wires Retry as the line does: disabled while retrying, reachable through retryRef", () => {
    const onRetry = vi.fn();
    const retryRef = createRef<HTMLButtonElement>();
    const { rerender } = render(
      <LoadFailure
        orientation="horizontal"
        message="Failed."
        detail={undefined}
        onRetry={onRetry}
        retrying={true}
        retryRef={retryRef}
      />,
    );
    const retry = screen.getByRole("button", { name: "Retry" });
    expect(retryRef.current).toBe(retry);
    fireEvent.click(retry);
    expect(onRetry).not.toHaveBeenCalled();
    rerender(
      <LoadFailure
        orientation="horizontal"
        message="Failed."
        detail={undefined}
        onRetry={onRetry}
        retrying={false}
        retryRef={retryRef}
      />,
    );
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("RefreshFailure", () => {
  it("names what failed and says that saved data remains visible", () => {
    render(
      <RefreshFailure
        what="the inbox"
        detail="503 Unavailable"
        onRetry={() => {}}
        retrying={false}
      />,
    );

    expect(
      screen.getByText(
        "Couldn't refresh the inbox (503 Unavailable) — showing saved data.",
      ),
    ).toBeTruthy();
  });

  it("retries exactly once per click", () => {
    const onRetry = vi.fn();
    render(
      <RefreshFailure
        what="the inbox"
        detail="boom"
        onRetry={onRetry}
        retrying={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("disables the button while retrying", () => {
    const onRetry = vi.fn();
    render(
      <RefreshFailure
        what="the inbox"
        detail="boom"
        onRetry={onRetry}
        retrying={true}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("puts the raw error on the message line's title, not the button's", () => {
    render(
      <RefreshFailure
        what="the inbox"
        detail="503 Unavailable"
        onRetry={() => {}}
        retrying={false}
      />,
    );
    const line = screen.getByText(
      "Couldn't refresh the inbox (503 Unavailable) — showing saved data.",
    );

    expect(line.getAttribute("title")).toBe("503 Unavailable");
    expect(
      screen.getByRole("button", { name: "Retry" }).getAttribute("title"),
    ).toBeNull();
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CodeBlock } from "../src/code-block.tsx";

vi.mock("@pierre/diffs", () => ({ registerCustomTheme: () => {} }));
vi.mock("@pierre/diffs/react", () => {
  throw new TypeError("Failed to fetch dynamically imported module");
});

it("shows plain text when pierre's chunk never arrives", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { container } = render(
    <CodeBlock filename="a.ts" contents="const a = 1;" copy={false} />,
  );
  await waitFor(() => {
    expect(warn).toHaveBeenCalledWith(
      "pierre CodeView failed; showing plain text",
      expect.anything(),
    );
  });
  expect(screen.getByText("const a = 1;")).not.toBeNull();
  // The plain text is the boundary's own, no longer the hidden view's box.
  expect(container.querySelector("[style*=hidden]")).toBeNull();
});

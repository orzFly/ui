import { setTimeout as delay } from "node:timers/promises";
import {
  type Completion,
  type CompletionSource,
  completionStatus,
} from "@codemirror/autocomplete";
import { createCommandRegistry, type ValueProviders } from "@orz/query";
import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownEditor } from "../src/components/markdown-editor.tsx";
import {
  completionRowClass,
  completionWith,
  reactOption,
} from "../src/extensions/completion.ts";
import { commandCompletionSource } from "../src/extensions/slash-commands.ts";
import { cmType, cmView } from "./cm.ts";

const people = new WeakMap<Completion, string>();

const mentions: CompletionSource = (context) => {
  const match = context.matchBefore(/@\w*$/);
  if (match === null) return null;
  const options = ["alice", "bot-one"].map((login) => {
    const option: Completion = { label: `@${login}` };
    people.set(option, login.slice(0, 1).toUpperCase());
    return option;
  });
  // A row nobody is recorded for keeps the plain look.
  options.push({ label: "@everyone" });
  return { from: match.from, options, validFor: /^@\w*$/ };
};

const avatar = reactOption(20, "cm-completionAvatar", (completion) => {
  const initial = people.get(completion);
  return initial === undefined ? null : <b data-avatar>{initial}</b>;
});

function mount() {
  return render(
    <MarkdownEditor
      ariaLabel="Body"
      extensions={completionWith([mentions], {
        optionClass: (c) => (people.has(c) ? completionRowClass.drawn : ""),
        addToOptions: [avatar],
      })}
    />,
  );
}

async function open(root: HTMLElement) {
  act(() => cmType(root, "@"));
  await waitFor(() =>
    expect(completionStatus(cmView(root).state)).toBe("active"),
  );
  await waitFor(() =>
    expect(root.querySelectorAll("[data-avatar]")).toHaveLength(2),
  );
}

describe("completion rows drawn by React", () => {
  it("draws a part on the rows it knows, and tags them with the row class", async () => {
    const { container } = mount();
    await open(container);
    const rows = [...container.querySelectorAll(".cm-tooltip-autocomplete li")];
    expect(
      rows.map((row) => row.className.includes("cm-completion-drawn")),
    ).toEqual([true, true, false]);
    expect(
      rows.map(
        (row) => row.querySelector(".cm-completionAvatar")?.textContent ?? null,
      ),
    ).toEqual(["A", "B", null]);
  });

  it("sizes an avatar in a drawn row to the row's line", async () => {
    const { container } = mount();
    await open(container);
    const drawn = container.querySelector<HTMLElement>("[data-avatar]");
    if (drawn === null) throw new Error("no avatar drawn");
    drawn.dataset.slot = "avatar";
    expect(getComputedStyle(drawn).width).toBe("18px");
    expect(getComputedStyle(drawn).height).toBe("18px");
  });

  it("stands a drawn part in the icon's column, so every row's text starts at one place", async () => {
    const { container } = mount();
    await open(container);
    const [person, , plain] = container.querySelectorAll<HTMLElement>(
      ".cm-tooltip-autocomplete li",
    );
    const icon = plain?.querySelector(".cm-completionIcon");
    const part = person?.querySelector(".cm-completionAvatar");
    if (!person || !plain || !icon || !part) throw new Error("rows not drawn");
    expect(getComputedStyle(icon).width).toBe("14px");
    expect(getComputedStyle(part).width).toBe("14px");
    expect(getComputedStyle(part).justifyContent).toBe("center");
    expect(getComputedStyle(part).flexShrink).toBe("0");
    expect(getComputedStyle(person).gap).toBe(getComputedStyle(plain).gap);
  });

  it("unmounts a part's root once its row has left the DOM", async () => {
    const { container } = mount();
    await open(container);
    const first = container.querySelector(".cm-completionAvatar");
    act(() => cmType(container, ""));
    await waitFor(() =>
      expect(container.querySelector(".cm-tooltip-autocomplete")).toBeNull(),
    );
    expect(first?.isConnected).toBe(false);
    // The next render sweeps what the last one left behind.
    await delay(0);
    await open(container);
    expect(first?.childNodes).toHaveLength(0);
  });
});

describe("slash-command argument rows drawn by the app", () => {
  type Status = { value: string; tone: string };
  const registry = createCommandRegistry([
    {
      name: "move",
      detail: "change status",
      args: [{ name: "status", value: { kind: "named", source: "status" } }],
      summarize: () => "move",
      compile: () => "move",
    },
  ]);
  const options: Status[] = [
    { value: "Todo", tone: "neutral" },
    { value: "Done", tone: "success" },
  ];
  const providers: ValueProviders = { status: { options } };
  const statuses = new WeakMap<Completion, Status>();
  const pill = reactOption(20, "cm-completionPill", (completion) => {
    const status = statuses.get(completion);
    return status === undefined ? null : (
      <b data-tone={status.tone}>{status.value}</b>
    );
  });

  it("draws each argument as the app draws its value, in the row's face", async () => {
    const { container } = render(
      <MarkdownEditor
        ariaLabel="Body"
        extensions={completionWith(
          [
            commandCompletionSource(
              () => registry,
              () => providers,
              {
                argumentOption: (completion, { option, spec }) => {
                  if (spec.kind === "named" && spec.source === "status") {
                    statuses.set(completion, option as Status);
                  }
                  return completion;
                },
              },
            ),
          ],
          {
            optionClass: (c) =>
              statuses.has(c) ? completionRowClass.face : "",
            addToOptions: [pill],
          },
        )}
      />,
    );
    act(() => cmType(container, "/move "));
    await waitFor(() =>
      expect(container.querySelectorAll("[data-tone]")).toHaveLength(2),
    );
    const rows = [...container.querySelectorAll(".cm-tooltip-autocomplete li")];
    expect(
      rows.map((row) => row.className.includes("cm-completion-face")),
    ).toEqual([true, true]);
    expect(
      rows.map((row) =>
        row.querySelector("[data-tone]")?.getAttribute("data-tone"),
      ),
    ).toEqual(["neutral", "success"]);
    // The face stands where the label would, with the type's icon ahead of
    // it in the column every row shares.
    const icon = rows[0]?.querySelector(".cm-completionIcon");
    if (!icon) throw new Error("no icon column");
    const style = getComputedStyle(icon);
    expect([style.display, style.order]).toEqual(["inline-block", "-1"]);
  });
});

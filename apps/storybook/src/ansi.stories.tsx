import { AnsiView } from "@orz/ui-ansi";
import type { Meta, StoryObj } from "@storybook/react-vite";

const E = "\x1b[";
const link = (url: string, text: string) =>
  `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`;

function hue(i: number, n: number): string {
  const h = (i / n) * 6;
  const f = (k: number) =>
    Math.round(255 * Math.max(0, Math.min(1, Math.abs(((h + k) % 6) - 3) - 1)));
  return `${E}48:2::${f(0)}:${f(4)}:${f(2)}m `;
}

const SAMPLE = [
  `${E}1m$ pnpm build${E}0m`,
  `${E}2m> tsc -p tsconfig.build.json${E}22m`,
  `docs: ${link("https://example.com/docs", "https://example.com/docs")}`,
  `[${E}32m#####${E}0m               ]  25%\r[${E}32m##########${E}0m          ]  50%\r[${E}32m####################${E}0m] 100% ${E}1;32mdone${E}0m`,
  `${E}33mwarning${E}0m: unused import ${E}1m'useMemo'${E}22m in ${E}4msrc/app.tsx${E}24m`,
  `${E}31;1merror${E}0m${E}1m TS2322:${E}0m Type 'string' is not assignable to type 'number'.`,
  `${E}4:3m${E}58;5;9mcurly underline${E}59;24m, ${E}9mstrike${E}29m, ${E}3mitalic${E}23m, ${E}7m inverse ${E}27m, ${E}53moverline${E}55m`,
  `16: ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `${E}4${i}m  `).join("")}${E}0m ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `${E}10${i}m  `).join("")}${E}0m`,
  `256: ${Array.from({ length: 36 }, (_, i) => `${E}48;5;${16 + i * 6}m `).join("")}${E}0m${Array.from({ length: 24 }, (_, i) => `${E}48;5;${232 + i}m `).join("")}${E}0m`,
  `24-bit: ${Array.from({ length: 48 }, (_, i) => hue(i, 48)).join("")}${E}0m`,
  `${E}90m  at render (src/app.tsx:12:7)${E}0m`,
  `Tests: ${E}32m41 passed${E}0m, ${E}31m1 failed${E}0m, 42 total`,
  `this text is erased${E}2K\rtext written after an erase-line`,
  `${E}1;36mInfo${E}0m bold cyan, ${E}1;34mbold blue${E}0m (the bold-is-bright toggle changes these)`,
].join("\n");

// A fixed seed, so every load of the story draws the same log.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LEVELS = [
  `${E}32mINFO${E}0m `,
  `${E}32mINFO${E}0m `,
  `${E}32mINFO${E}0m `,
  `${E}2mDEBUG${E}22m`,
  `${E}33mWARN${E}0m `,
  `${E}1;31mERROR${E}0m`,
];
const WORDS =
  "fetch resolve module chunk worker cache build emit bundle asset graph 依赖 构建 缓存 完成 タスク".split(
    " ",
  );

function largeLog(lines: number): string {
  const random = mulberry32(39);
  const pick = <T,>(items: readonly T[]) =>
    items[Math.floor(random() * items.length)];
  const out: string[] = [];
  for (let i = 0; i < lines; i++) {
    const n = String(i + 1).padStart(6, "0");
    const roll = random();
    if (roll < 0.03) {
      const steps = [10, 40, 70, 100];
      out.push(
        steps
          .map((p) => {
            const done = Math.round(p / 5);
            return `${E}36m[${"#".repeat(done)}${" ".repeat(20 - done)}]${E}0m ${p}%`;
          })
          .join("\r"),
      );
    } else if (roll < 0.04) {
      out.push(
        `${n} see ${link(`https://example.com/run/${i}`, `https://example.com/run/${i}`)}`,
      );
    } else {
      const words = Array.from({ length: 3 + Math.floor(random() * 25) }, () =>
        pick(WORDS),
      ).join(" ");
      out.push(`${E}90m${n}${E}0m ${pick(LEVELS)} ${words}`);
    }
  }
  return out.join("\n");
}

const LARGE = largeLog(200_000);

/**
 * Text with ANSI escapes drawn in the toolbar's terminal colours: palette 0–15 follow the theme,
 * 256-colour and 24-bit stay absolute.
 */
const meta = {
  title: "ui-ansi/AnsiView",
  component: AnsiView,
  args: { text: SAMPLE, chrome: "pane" },
  decorators: [
    (Story) => (
      <div className="max-w-4xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AnsiView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The terminal pane a fence draws: no header, Copy and Wrap on hover or focus. */
export const Pane: Story = {};

/** The chrome an `.ansi` attachment draws: filename, line count, line numbers and Download. */
export const File: Story = {
  args: { chrome: "file", filename: "build.log", downloadUrl: "#" },
};

/** 200,000 generated lines: only the rows in view are mounted. */
export const LargeLog: Story = {
  name: "Large log",
  args: {
    text: LARGE,
    chrome: "file",
    filename: "ci.log",
    downloadUrl: "#",
    maxHeight: "32rem",
  },
};

/** Bold text in palette colours 0–7 drawn in 8–15, as many terminals do. */
export const BoldIsBright: Story = {
  name: "Bold is bright",
  args: { boldIsBright: true },
};

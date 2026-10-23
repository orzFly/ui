import { MermaidBlock } from "@orz/ui-mermaid";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { withWidth } from "./decorators.tsx";

const FLOWCHART = `flowchart LR
  request[Request] --> auth{Signed in?}
  auth -- yes --> load[Load the board]
  auth -- no --> login[Sign-in page]
  load --> render[Render]
  login --> auth`;

const GALLERY: { title: string; source: string }[] = [
  {
    title: "Flowchart",
    source: FLOWCHART,
  },
  {
    title: "Flowchart with CJK labels",
    source: `flowchart TD
  start[打开看板] --> pick{选择卡片}
  pick -- 新卡片 --> draft[填写标题与描述]
  pick -- 已有卡片 --> edit[编辑内容]
  draft --> save[保存]
  edit --> save`,
  },
  {
    title: "Sequence",
    source: `sequenceDiagram
  participant alice as Browser
  participant api as Server
  participant db as Database
  alice->>api: POST /cards
  api->>db: insert
  db-->>api: id
  api-->>alice: 201 Created`,
  },
  {
    title: "Class",
    source: `classDiagram
  class Card {
    +number id
    +string title
    +move(status)
  }
  class Comment {
    +string body
  }
  Card "1" --> "*" Comment`,
  },
  {
    title: "State",
    source: `stateDiagram-v2
  [*] --> Backlog
  Backlog --> Next
  Next --> InProgress
  InProgress --> ReadyToShip
  ReadyToShip --> Shipped
  Shipped --> [*]`,
  },
  {
    title: "Entity relationship",
    source: `erDiagram
  PROJECT ||--o{ CARD : holds
  CARD ||--o{ COMMENT : has
  CARD }o--o{ LABEL : tagged`,
  },
  {
    title: "Gantt",
    source: `gantt
  dateFormat YYYY-MM-DD
  title Release plan
  section Build
  Registry      :done, a1, 2026-01-05, 7d
  Renderers     :active, a2, after a1, 10d
  section Ship
  Publish       :a3, after a2, 3d`,
  },
];

const BROKEN = `flowchart LR
  A[start --> B[[end`;

const WIDE = `flowchart LR
  one[Step one] --> two[Step two] --> three[Step three] --> four[Step four]
  four --> five[Step five] --> six[Step six] --> seven[Step seven]
  seven --> eight[Step eight] --> nine[Step nine] --> ten[Step ten]
  ten --> eleven[Step eleven] --> twelve[Step twelve]`;

const meta = {
  title: "ui-mermaid/MermaidBlock",
  component: MermaidBlock,
  args: { source: FLOWCHART },
} satisfies Meta<typeof MermaidBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  decorators: [withWidth("max-w-3xl text-sm")],
};

/** One diagram of each common kind. The toolbar's theme switch draws them again in its colours. */
export const Kinds: Story = {
  decorators: [withWidth("max-w-5xl text-sm")],
  render: (args) => (
    <div className="grid gap-8">
      {GALLERY.map(({ title, source }) => (
        <section key={title} className="flex flex-col gap-2">
          <h3 className="font-medium">{title}</h3>
          <MermaidBlock {...args} source={source} />
        </section>
      ))}
    </div>
  ),
};

/** Wider than its column: it shrinks down to 75% of its natural width, then scrolls. */
export const Wide: Story = {
  decorators: [withWidth("max-w-xl rounded-lg border p-3 text-sm")],
  args: { source: WIDE },
};

/** A diagram that does not parse keeps its source, with the parser's message under it. */
export const ParseError: Story = {
  tags: ["edge", "!autodocs"],
  decorators: [withWidth("max-w-3xl text-sm")],
  args: { source: BROKEN },
};

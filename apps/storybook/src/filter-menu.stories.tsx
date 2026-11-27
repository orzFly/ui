import { Button } from "@orz/ui/components/button";
import {
  FilterMenu,
  type FilterMenuSection,
  MatchedText,
  matchText,
} from "@orz/ui/components/filter-menu";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChevronDownIcon, PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { fn } from "storybook/test";
import { argsUpdater } from "./args.ts";

interface Place {
  id: string;
  label: string;
  region?: string;
  disabled?: boolean;
  action?: boolean;
}

const CITIES: Place[] = [
  { id: "lisbon", label: "Lisbon", region: "Europe" },
  { id: "malmo", label: "Malmö", region: "Europe" },
  { id: "reykjavik", label: "Reykjavík", region: "Europe" },
  { id: "zurich", label: "Zürich", region: "Europe" },
  { id: "bogota", label: "Bogotá", region: "Americas" },
  { id: "montreal", label: "Montréal", region: "Americas" },
  { id: "sao-paulo", label: "São Paulo", region: "Americas" },
  { id: "valparaiso", label: "Valparaíso", region: "Americas", disabled: true },
  { id: "hanoi", label: "Hà Nội", region: "Asia" },
  { id: "kyoto", label: "Kyōto", region: "Asia" },
  { id: "osaka", label: "Ōsaka", region: "Asia" },
  { id: "seoul", label: "Seoul", region: "Asia" },
];

const BY_REGION: FilterMenuSection<Place>[] = [
  "Europe",
  "Americas",
  "Asia",
].map((region) => ({
  id: region,
  label: region,
  rows: CITIES.filter((c) => c.region === region),
}));

const DISTRICTS: Record<string, string[]> = {
  lisbon: ["Alfama", "Baixa", "Belém"],
  zurich: ["Altstadt", "Wiedikon"],
  "sao-paulo": ["Liberdade", "Pinheiros", "Vila Madalena"],
  kyoto: ["Gion", "Arashiyama", "Higashiyama"],
  seoul: ["Jongno", "Mapo"],
};

function districtsOf(city: Place): Place[] | undefined {
  return DISTRICTS[city.id]?.map((label) => ({
    id: `${city.id}/${label}`,
    label,
  }));
}

const STOPS: Record<string, string[]> = {
  Europe: [
    "Amsterdam",
    "Athína",
    "Barcelona",
    "Berlin",
    "Bruxelles",
    "Budapest",
    "České Budějovice",
    "Dublin",
    "Göteborg",
    "Kraków",
    "Lisbon",
    "Ljubljana",
    "Malmö",
    "Porto",
    "Praha",
    "Reykjavík",
    "Rīga",
    "Sevilla",
    "Tallinn",
    "Wien",
    "Zürich",
  ],
  Americas: [
    "Bogotá",
    "Buenos Aires",
    "Cusco",
    "Halifax",
    "La Paz",
    "Medellín",
    "Mérida",
    "Montréal",
    "Oaxaca",
    "Québec",
    "Santiago",
    "São Paulo",
    "Valparaíso",
  ],
  Asia: ["Đà Lạt", "Hà Nội", "Huế", "Kyōto", "Ōsaka", "Seoul", "Tainan"],
};

const REGIONS: Place[] = [
  { id: "anywhere", label: "Anywhere" },
  ...Object.keys(STOPS).map((region) => ({ id: region, label: region })),
];

function stopsOf(row: Place, query: string): Place[] | undefined {
  return STOPS[row.id]
    ?.filter((label) => matchText(label, query))
    .map((label) => ({ id: `${row.id}/${label}`, label, region: row.id }));
}

/** The trigger's text for a picked id: `kyoto`, or `kyoto/Gion` inside a submenu. */
function labelOf(id: string, added: readonly Place[] = []): string {
  const [head = "", tail] = id.split("/");
  const label =
    [...CITIES, ...REGIONS, ...added].find((row) => row.id === head)?.label ??
    head;
  return tail ? `${label} › ${tail}` : label;
}

/** `text` is `label`, folded as the filter folds it: `malmo` is `Malmö`. */
function sameName(label: string, text: string): boolean {
  const range = matchText(label, text);
  return range !== null && range.start === 0 && range.end === label.length;
}

/** A region's row in `StayingOpen`: it narrows the list to the region rather than picking. */
const REGION_ROWS: Place[] = ["Europe", "Americas", "Asia"].map((region) => ({
  id: `in:${region}`,
  label: `${region}…`,
  region,
  action: true,
}));

/** `Europe: lis` is the cities of Europe filtered by `lis`. */
function inRegion(query: string): { region: string; rest: string } | null {
  const match = /^(Europe|Americas|Asia):\s*(.*)$/.exec(query);
  return match ? { region: match[1] ?? "", rest: match[2] ?? "" } : null;
}

const STAYING_OPEN_SOURCE = `import { FilterMenu, MatchedText } from "@orz/ui/components/filter-menu";

<FilterMenu
  query={query}
  onQueryChange={setQuery}
  // A row per region (\`Europe…\`, marked \`action\`), then the cities;
  // under \`Europe: \` only Europe's.
  sections={sections}
  selectedId={city}
  onSelect={(row, event) => {
    if (row.action) {
      // Narrows the list rather than picking: the menu stays open.
      event.preventDefault();
      setQuery(\`\${row.region}: \`);
      return;
    }
    setCity(row.id);
  }}
  renderRow={(row) => <MatchedText text={row.label} query={needle} />}
  inputLabel="Filter cities"
  placeholder="Filter cities…"
  listLabel="Cities"
>
  <Button variant="outline">{label}</Button>
</FilterMenu>`;

const LINKS_SOURCE = `import { FilterMenu, MatchedText } from "@orz/ui/components/filter-menu";

<FilterMenu
  query={query}
  onQueryChange={setQuery}
  sections={sections}
  selectedId={city}
  onSelect={(row) => setCity(row.id)}
  // Or a router's link: (row) => <Link to="/cities/$id" params={{ id: row.id }} />
  rowLink={(row) => \`#\${row.id}\`}
  renderRow={(row, state) => <MatchedText text={row.label} query={state.query} />}
  inputLabel="Filter cities"
  placeholder="Filter cities…"
  listLabel="Cities"
>
  <Button variant="outline">{label}</Button>
</FilterMenu>`;

const meta = {
  title: "ui/FilterMenu",
  parameters: { guidelines: "/guidelines/patterns/choosing-a-control/" },
  component: FilterMenu,
  args: {
    query: "",
    onQueryChange: fn(),
    onSelect: fn(),
    onHighlight: fn(),
    sections: BY_REGION,
    selectedId: "kyoto",
    renderRow: (row, state) =>
      row.action ? (
        <>
          <PlusIcon aria-hidden />
          <span>{row.label}</span>
        </>
      ) : (
        <MatchedText text={row.label} query={state.query} />
      ),
    inputLabel: "Filter cities",
    placeholder: "Filter cities…",
    listLabel: "Cities",
    className: "w-64",
    // Required by the type; the render puts a trigger showing the pick here.
    children: <Button variant="outline">City</Button>,
  },
  argTypes: {
    query: { control: false },
    sections: { control: false },
    renderRow: { control: false },
    children: { control: false },
    getSubmenu: { control: false },
    submenuFilter: { control: false },
    submenuLabel: { control: false },
    rowLink: { control: false },
  },
  render: function Render(args, context) {
    const updateArgs = argsUpdater(context);
    const [query, setQuery] = useState("");
    // Under multiple selection, cities added by the `Add “…”` row.
    const [added, setAdded] = useState<Place[]>([]);
    const multiple = args.selection === "multiple";
    const selectedIds = args.selectedIds ?? [];
    // The menu takes its sections already filtered for the query.
    const sections = useMemo(() => {
      const last = args.sections.length - 1;
      const filtered = args.sections.map((s, i) => ({
        ...s,
        rows: [...s.rows, ...(i === last ? added : [])].filter((r) =>
          matchText(r.label, query),
        ),
      }));
      const typed = query.trim();
      const known = [...CITIES, ...added].some((c) => sameName(c.label, typed));
      if (!multiple || typed === "" || known) return filtered;
      const add = { id: "add", label: `Add “${typed}”`, action: true };
      return [...filtered, { id: "add", rows: [add] }];
    }, [args.sections, query, added, multiple]);
    return (
      <FilterMenu
        {...args}
        query={query}
        onQueryChange={(q) => {
          setQuery(q);
          args.onQueryChange(q);
        }}
        sections={sections}
        onSelect={(row, event) => {
          args.onSelect?.(row, event);
          if (!multiple) {
            // An undefined arg is dropped, so a plain city clears the submenu pick.
            updateArgs({
              selectedId: row.id.split("/")[0],
              selectedSubmenuId: args.getSubmenu ? row.id : undefined,
            });
          } else if (row.action) {
            const label = query.trim();
            const city = { id: `added:${label}`, label };
            setAdded((cities) => [...cities, city]);
            updateArgs({ selectedIds: [...selectedIds, city.id] });
            setQuery("");
          } else {
            updateArgs({
              selectedIds: event.selected
                ? [...selectedIds, row.id]
                : selectedIds.filter((id) => id !== row.id),
              mixedIds: args.mixedIds?.filter((id) => id !== row.id),
            });
          }
        }}
      >
        <Button variant="outline" className="w-48 justify-between">
          {multiple ? (
            <span className="truncate">
              {selectedIds.map((id) => labelOf(id, added)).join(", ") ||
                "Cities"}
            </span>
          ) : (
            labelOf(args.selectedSubmenuId ?? args.selectedId ?? "")
          )}
          <ChevronDownIcon />
        </Button>
      </FilterMenu>
    );
  },
} satisfies Meta<typeof FilterMenu<Place>>;

export default meta;
// Typed from the row type: the meta's generic `component` would type rows as
// `FilterMenuRow`, without the labels the args read.
type Story = StoryObj<typeof FilterMenu<Place>>;

/**
 * Sections with labels; try `sao`, `kyo` or `zur`, diacritics folded. With
 * the toolbar's pointer at coarse it opens as on a phone, the focus on the
 * list and the filter box left for a tap.
 */
export const Playground: Story = {};

/** One unlabelled section: the shape a plain select-like list takes. */
export const Plain: Story = {
  args: { sections: [{ id: "all", rows: CITIES }] },
};

/**
 * A city picks itself; its districts open beside it on hover or →, and ← or
 * Escape come back. The pointer may cut across other cities on its way in.
 */
export const WithSubmenus: Story = {
  args: {
    selectedSubmenuId: "kyoto/Gion",
    getSubmenu: districtsOf,
    submenuLabel: (row) => `${row.label} districts`,
  },
};

/**
 * A region picks the whole region; its submenu lists the stops in it, with a
 * filter box of its own. The box takes the keys once the pointer enters the
 * submenu, or on → from the menu's box; ← at its start or Escape hand them
 * back.
 */
export const WithSearchableSubmenus: Story = {
  args: {
    sections: [{ id: "regions", rows: REGIONS }],
    selectedId: "anywhere",
    selectedSubmenuId: "anywhere",
    getSubmenu: stopsOf,
    submenuFilter: (row) => ({ placeholder: `Filter ${row.label}…` }),
    submenuLabel: (row) => `Stops in ${row.label}`,
    inputLabel: "Filter regions",
    placeholder: "Filter regions…",
    listLabel: "Regions",
    className: "w-56",
  },
};

/**
 * Each city is a place with a page of its own, so each row is its link: a
 * middle or modified click opens it in a new tab and leaves the menu open,
 * and the row drags onto the bookmarks bar.
 */
export const WithLinks: Story = {
  args: {
    rowLink: (row) => `#${row.id}`,
  },
  parameters: { docs: { source: { code: LINKS_SOURCE, language: "tsx" } } },
};

/**
 * Each city on or off by itself, the menu open throughout. A name that is no
 * city yet gets an `Add “…”` row, an `action`, which adds it checked.
 */
export const Multiple: Story = {
  args: {
    selection: "multiple",
    selectedIds: ["lisbon", "kyoto"],
    selectedId: undefined,
    sections: [{ id: "all", rows: CITIES }],
  },
};

/**
 * Cities on only some of the things being edited are partly picked; a pick
 * makes one picked.
 */
export const Mixed: Story = {
  args: {
    selection: "multiple",
    selectedIds: ["kyoto"],
    mixedIds: ["lisbon", "seoul", "sao-paulo"],
    selectedId: undefined,
    sections: [{ id: "all", rows: CITIES }],
  },
};

/**
 * A region's row narrows the list to its cities rather than picking: its
 * `onSelect` prevents the default, so the menu stays open, and writes
 * `Europe: ` into the box. A city picks and closes as ever.
 */
export const StayingOpen: Story = {
  parameters: {
    docs: { source: { code: STAYING_OPEN_SOURCE, language: "tsx" } },
  },
  render: function Render(args, context) {
    const updateArgs = argsUpdater(context);
    const [query, setQuery] = useState("");
    const scope = inRegion(query);
    const needle = scope ? scope.rest : query;
    const sections = useMemo(() => {
      const within = inRegion(query);
      const cities = args.sections
        .filter((s) => !within || s.id === within.region)
        .map((s) => ({
          ...s,
          rows: s.rows.filter((r) =>
            matchText(r.label, within ? within.rest : query),
          ),
        }));
      if (within) return cities;
      const regions = REGION_ROWS.filter((r) => matchText(r.label, query));
      return [{ id: "regions", rows: regions }, ...cities];
    }, [args.sections, query]);
    return (
      <FilterMenu
        {...args}
        query={query}
        onQueryChange={(q) => {
          setQuery(q);
          args.onQueryChange(q);
        }}
        sections={sections}
        renderRow={(row) => <MatchedText text={row.label} query={needle} />}
        onSelect={(row, event) => {
          args.onSelect?.(row, event);
          if (row.action) {
            event.preventDefault();
            setQuery(`${row.region}: `);
            return;
          }
          updateArgs({ selectedId: row.id });
        }}
      >
        <Button variant="outline" className="w-48 justify-between">
          {labelOf(args.selectedId ?? "")}
          <ChevronDownIcon />
        </Button>
      </FilterMenu>
    );
  },
};

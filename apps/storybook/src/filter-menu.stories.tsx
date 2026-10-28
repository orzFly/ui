import { Button } from "@orz/ui/components/button";
import {
  FilterMenu,
  type FilterMenuSection,
  MatchedText,
  matchText,
} from "@orz/ui/components/filter-menu";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChevronDownIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { fn } from "storybook/test";
import { argsUpdater } from "./args.ts";

interface Place {
  id: string;
  label: string;
  region?: string;
  disabled?: boolean;
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
function labelOf(id: string): string {
  const [head = "", tail] = id.split("/");
  const label =
    [...CITIES, ...REGIONS].find((row) => row.id === head)?.label ?? head;
  return tail ? `${label} › ${tail}` : label;
}

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
    renderRow: (row, state) => (
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
  },
  render: function Render(args, context) {
    const updateArgs = argsUpdater(context);
    const [query, setQuery] = useState("");
    // The menu takes its sections already filtered for the query.
    const sections = useMemo(
      () =>
        args.sections.map((s) => ({
          ...s,
          rows: s.rows.filter((r) => matchText(r.label, query)),
        })),
      [args.sections, query],
    );
    return (
      <FilterMenu
        {...args}
        query={query}
        onQueryChange={(q) => {
          setQuery(q);
          args.onQueryChange(q);
        }}
        sections={sections}
        onSelect={(row) => {
          // An undefined arg is dropped, so a plain city clears the submenu pick.
          updateArgs({
            selectedId: row.id.split("/")[0],
            selectedSubmenuId: args.getSubmenu ? row.id : undefined,
          });
          args.onSelect(row);
        }}
      >
        <Button variant="outline" className="w-48 justify-between">
          {labelOf(args.selectedSubmenuId ?? args.selectedId ?? "")}
          <ChevronDownIcon className="text-muted-foreground" />
        </Button>
      </FilterMenu>
    );
  },
} satisfies Meta<typeof FilterMenu<Place>>;

export default meta;
// Typed from the row type: the meta's generic `component` would type rows as
// `FilterMenuRow`, without the labels the args read.
type Story = StoryObj<typeof FilterMenu<Place>>;

/** Sections with labels; try `sao`, `kyo` or `zur`, diacritics folded. */
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

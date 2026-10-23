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

const meta = {
  title: "ui/FilterMenu",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

interface City {
  id: string;
  label: string;
  region: string;
  disabled?: boolean;
}

const CITIES: City[] = [
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

function CityPicker({ grouped }: { grouped: boolean }) {
  const [city, setCity] = useState("kyoto");
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState<City | null>(null);
  const sections = useMemo<FilterMenuSection<City>[]>(() => {
    const rows = CITIES.filter((c) => matchText(c.label, query));
    if (!grouped) return [{ id: "all", rows }];
    return ["Europe", "Americas", "Asia"].map((region) => ({
      id: region,
      label: region,
      rows: rows.filter((c) => c.region === region),
    }));
  }, [grouped, query]);
  const label = CITIES.find((c) => c.id === city)?.label;
  return (
    <div className="flex items-start gap-4">
      <FilterMenu
        query={query}
        onQueryChange={setQuery}
        sections={sections}
        selectedId={city}
        onSelect={(row) => setCity(row.id)}
        onHighlight={setHighlight}
        renderRow={(row) => <MatchedText text={row.label} query={query} />}
        inputLabel="Filter cities"
        placeholder="Filter cities…"
        listLabel="Cities"
        className="w-64"
      >
        <Button variant="outline" className="w-48 justify-between">
          {label}
          <ChevronDownIcon className="text-muted-foreground" />
        </Button>
      </FilterMenu>
      <p className="py-1.5 text-muted-foreground text-sm">
        Previewing: {highlight?.label ?? "nothing (the committed pick shows)"}
      </p>
    </div>
  );
}

/** Sections with labels; try `sao`, `kyo` or `zur`, diacritics folded. */
export const Grouped: Story = {
  render: () => <CityPicker grouped />,
};

/** One unlabelled section: the shape a plain select-like list takes. */
export const Plain: Story = {
  render: () => <CityPicker grouped={false} />,
};

interface Place {
  id: string;
  label: string;
}

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

function DistrictPicker() {
  const [pick, setPick] = useState<Place>({ id: "kyoto/Gion", label: "Gion" });
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState<Place | null>(null);
  const sections = useMemo<FilterMenuSection<Place>[]>(() => {
    const rows = CITIES.filter((c) => matchText(c.label, query));
    return ["Europe", "Americas", "Asia"].map((region) => ({
      id: region,
      label: region,
      rows: rows.filter((c) => c.region === region),
    }));
  }, [query]);
  return (
    <div className="flex items-start gap-4">
      <FilterMenu
        query={query}
        onQueryChange={setQuery}
        sections={sections}
        selectedId={pick.id.split("/")[0]}
        selectedSubmenuId={pick.id}
        getSubmenu={districtsOf}
        submenuLabel={(row) => `${row.label} districts`}
        onSelect={setPick}
        onHighlight={setHighlight}
        renderRow={(row, state) => (
          <MatchedText text={row.label} query={state.query} />
        )}
        inputLabel="Filter cities"
        placeholder="Filter cities…"
        listLabel="Cities"
        className="w-64"
      >
        <Button variant="outline" className="w-48 justify-between">
          {pick.label}
          <ChevronDownIcon className="text-muted-foreground" />
        </Button>
      </FilterMenu>
      <p className="py-1.5 text-muted-foreground text-sm">
        Previewing: {highlight?.label ?? "nothing (the committed pick shows)"}
      </p>
    </div>
  );
}

/**
 * A city picks itself; its districts open beside it on hover or →, and ← or
 * Escape come back. The pointer may cut across other cities on its way in.
 */
export const WithSubmenus: Story = {
  render: () => <DistrictPicker />,
};

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

interface Stop {
  id: string;
  label: string;
  region?: string;
}

const REGIONS: Stop[] = [
  { id: "anywhere", label: "Anywhere" },
  ...Object.keys(STOPS).map((region) => ({ id: region, label: region })),
];

function stopsOf(row: Stop, query: string): Stop[] | undefined {
  return STOPS[row.id]
    ?.filter((label) => matchText(label, query))
    .map((label) => ({ id: `${row.id}/${label}`, label, region: row.id }));
}

function StopPicker() {
  const [pick, setPick] = useState<Stop>(REGIONS[0] as Stop);
  const [query, setQuery] = useState("");
  const sections = useMemo<FilterMenuSection<Stop>[]>(
    () => [
      { id: "regions", rows: REGIONS.filter((r) => matchText(r.label, query)) },
    ],
    [query],
  );
  return (
    <FilterMenu
      query={query}
      onQueryChange={setQuery}
      sections={sections}
      selectedId={pick.region ?? pick.id}
      selectedSubmenuId={pick.id}
      getSubmenu={stopsOf}
      submenuFilter={(row) => ({ placeholder: `Filter ${row.label}…` })}
      submenuLabel={(row) => `Stops in ${row.label}`}
      onSelect={setPick}
      renderRow={(row, state) => (
        <MatchedText text={row.label} query={state.query} />
      )}
      inputLabel="Filter regions"
      placeholder="Filter regions…"
      listLabel="Regions"
      className="w-56"
    >
      <Button variant="outline" className="w-48 justify-between">
        {pick.region ? `${pick.region} › ${pick.label}` : pick.label}
        <ChevronDownIcon className="text-muted-foreground" />
      </Button>
    </FilterMenu>
  );
}

/**
 * A region picks the whole region; its submenu lists the stops in it, with a
 * filter box of its own. The box takes the keys once the pointer enters the
 * submenu, or on → from the menu's box; ← at its start or Escape hand them
 * back.
 */
export const WithSearchableSubmenus: Story = {
  render: () => <StopPicker />,
};

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
  title: "Patterns/FilterMenu",
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

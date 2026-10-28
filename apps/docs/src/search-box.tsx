import { Input } from "@orz/ui/components/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@orz/ui/components/popover";
import { cn } from "@orz/ui/lib/utils";
import { SearchIcon } from "lucide-react";
import {
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Link, useRouter } from "./router.tsx";
import { type ExcerptPart, type SearchHit, useSearch } from "./search.ts";
import { useShortcutsEnabled } from "./shortcuts.ts";

/** A row of the results: a page, or a heading under the page above it. */
interface SearchOption {
  route: string;
  hash: string;
  title: string;
  excerpt: ExcerptPart[];
  section: boolean;
}

function optionsOf(hits: SearchHit[]): SearchOption[] {
  return hits.flatMap((hit) => [
    { ...hit, hash: "", section: false },
    ...hit.sections.map((section) => ({ ...section, section: true })),
  ]);
}

/** The input and the result list as one combobox, whichever surface shows the list. */
function useSearchBox(onPick: () => void) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const state = useSearch(query);
  const options = optionsOf(state.hits);
  const { navigate } = useRouter();
  // biome-ignore lint/correctness/useExhaustiveDependencies: new results start from the top.
  useEffect(() => setActive(0), [state.hits]);

  const picked = () => {
    setQuery("");
    onPick();
  };
  const optionId = (index: number) => `${id}-${index}`;
  const showing = query.trim() !== "";
  const input = {
    type: "search",
    role: "combobox",
    "aria-label": "Search the docs",
    "aria-autocomplete": "list",
    "aria-controls": `${id}-list`,
    "aria-expanded": showing,
    "aria-activedescendant":
      showing && options[active] ? optionId(active) : undefined,
    autoComplete: "off",
    spellCheck: false,
    placeholder: "Search",
    value: query,
    onChange: (event) => setQuery(event.target.value),
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      if (options.length === 0) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActive((active + step + options.length) % options.length);
      } else if (event.key === "Enter") {
        const option = options[active];
        if (!option) return;
        event.preventDefault();
        navigate(option.route, option.hash);
        picked();
      }
    },
  } satisfies ComponentProps<"input">;
  const list = {
    id: `${id}-list`,
    query,
    state,
    options,
    active,
    optionId,
    onHover: setActive,
    onPick: picked,
  };
  return { query, input, list, showing };
}

function Excerpt({ parts }: { parts: ExcerptPart[] }) {
  return parts.map((part, i) =>
    part.match ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: an excerpt's parts never reorder.
      <mark key={i} className="bg-transparent font-medium text-foreground">
        {part.text}
      </mark>
    ) : (
      part.text
    ),
  );
}

function SearchResults({
  id,
  query,
  state,
  options,
  active,
  optionId,
  onHover,
  onPick,
  size,
}: ReturnType<typeof useSearchBox>["list"] & { size: "pointer" | "touch" }) {
  let status: string | undefined;
  if (state.status === "error") status = "Search is unavailable right now.";
  else if (state.status === "done" && options.length === 0) {
    status = `Nothing matches “${query.trim()}”.`;
  } else if (state.status === "loading" && options.length === 0) {
    status = "Searching…";
  }
  return (
    <div>
      <p role="status" className={cn(status ? "px-3 py-2" : "sr-only")}>
        {status ??
          (state.status === "done" &&
            `${state.hits.length} ${state.hits.length === 1 ? "page" : "pages"} found`)}
      </p>
      {/* Options that are links: a click, a middle click and Enter all go where a link goes. */}
      <div id={id} role="listbox" aria-label="Results">
        {options.map((option, index) => (
          <Link
            key={`${option.route}${option.hash}`}
            id={optionId(index)}
            role="option"
            aria-selected={index === active}
            to={option.route}
            hash={option.hash}
            tabIndex={-1}
            onMouseMove={() => onHover(index)}
            onClick={onPick}
            className={cn(
              "flex flex-col justify-center gap-0.5 rounded-md px-3 py-1.5 aria-selected:bg-accent",
              size === "touch" ? "min-h-11" : "min-h-8 pointer-coarse:min-h-11",
              option.section && "ml-3 border-l pl-3",
            )}
          >
            <span
              className={cn(
                "text-foreground",
                option.section ? "text-sm" : "font-medium",
              )}
            >
              {option.title}
            </span>
            <span className="line-clamp-2 text-muted-foreground text-xs">
              <Excerpt parts={option.excerpt} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

const Kbd = ({ className, ...props }: ComponentProps<"kbd">) => (
  <kbd
    className={cn(
      "rounded border px-1 font-mono text-[11px] text-muted-foreground",
      className,
    )}
    {...props}
  />
);

/** The top bar's search: a box whose results drop below it. */
export function SearchBox({
  inputRef,
  className,
}: {
  inputRef: Ref<HTMLInputElement>;
  className?: string;
}) {
  const [focused, setFocused] = useState(false);
  const field = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const local = useRef<HTMLInputElement>(null);
  const { query, input, list, showing } = useSearchBox(() =>
    local.current?.blur(),
  );
  const shortcut = useShortcutsEnabled();
  const setRefs = (node: HTMLInputElement | null) => {
    local.current = node;
    if (typeof inputRef === "function") inputRef(node);
    else if (inputRef) inputRef.current = node;
  };
  return (
    <Popover
      open={focused && showing}
      onOpenChange={(open) => {
        if (!open) local.current?.blur();
      }}
    >
      <PopoverAnchor asChild>
        <div ref={field} className={cn("relative", className)}>
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            {...input}
            ref={setRefs}
            className="pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
            onFocus={() => setFocused(true)}
            onBlur={(event) => {
              // Pressing a result moves focus into the list, which is still the search.
              if (!content.current?.contains(event.relatedTarget)) {
                setFocused(false);
              }
            }}
          />
          {shortcut && query === "" && (
            <Kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2">
              /
            </Kbd>
          )}
        </div>
      </PopoverAnchor>
      <PopoverContent
        ref={content}
        align="end"
        className="w-[28rem] text-sm"
        // The reader is still typing in the box.
        onOpenAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          if (field.current?.contains(event.target as Node)) {
            event.preventDefault();
          }
        }}
      >
        <SearchResults {...list} size="pointer" />
      </PopoverContent>
    </Popover>
  );
}

/**
 * The phone nav's search: the box heads the sheet, and while it holds a
 * query its results take the nav's place.
 */
export function SheetSearch({
  inputRef,
  onPick,
  children,
}: {
  inputRef: Ref<HTMLInputElement>;
  onPick: () => void;
  children: ReactNode;
}) {
  const { input, list, showing } = useSearchBox(onPick);
  return (
    <>
      <div className="relative mx-1 mt-2">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input {...input} ref={inputRef} className="h-11 pl-9" />
      </div>
      {showing ? (
        <div className="mt-2 text-base">
          <SearchResults {...list} size="touch" />
        </div>
      ) : (
        children
      )}
    </>
  );
}

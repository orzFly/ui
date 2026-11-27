import { PROVIDERS, QUALIFIERS } from "@orz/fixtures/query.ts";
import { defineQuerySchema } from "@orz/query";
import { QueryBox } from "@orz/ui/components/query-box";
import { useQueryHistory } from "@orz/ui/hooks/use-query-history";
import { SearchIcon } from "lucide-react";
import { useState } from "react";

const SCHEMA = defineQuerySchema({ qualifiers: QUALIFIERS, braces: true });

const resultsHref = (query: string) => `#q=${encodeURIComponent(query)}`;

export function IssueSearch() {
  const [value, setValue] = useState("");
  const history = useQueryHistory({
    storageKey: "orz-docs-example-search-history",
    scope: "issues",
  });
  return (
    // Room under the box for its panel, which the example's frame would
    // otherwise cut off; `limit` keeps the panel inside it.
    <div className="min-h-80">
      <QueryBox
        schema={SCHEMA}
        providers={PROVIDERS}
        value={value}
        onValueChange={setValue}
        history={history}
        queryHref={resultsHref}
        onSubmit={(query) => {
          history.record(query);
          setValue(query);
        }}
        renderSubmitRow={(query, option) => (
          <div {...option}>
            <SearchIcon
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span className="truncate">
              {query === "" ? "All issues" : `Search for “${query}”`}
            </span>
          </div>
        )}
        listAlign="start"
        leading={<SearchIcon />}
        inputProps={{
          "aria-label": "Search issues",
          placeholder: "Search, or try is:open…",
        }}
        limit={6}
        className="max-w-md"
      />
    </div>
  );
}

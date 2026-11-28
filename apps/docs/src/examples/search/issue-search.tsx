import {
  type LabelOption,
  type MemberOption,
  PROVIDERS,
  QUALIFIERS,
} from "@orz/fixtures/query.ts";
import { type CompletionValue, defineQuerySchema } from "@orz/query";
import { Avatar, AvatarFallback } from "@orz/ui/components/avatar";
import { Badge } from "@orz/ui/components/badge";
import { QueryBox, type ValueRowContent } from "@orz/ui/components/query-box";
import { useQueryHistory } from "@orz/ui/hooks/use-query-history";
import { SearchIcon } from "lucide-react";
import { useState } from "react";

const SCHEMA = defineQuerySchema({ qualifiers: QUALIFIERS, braces: true });

const resultsHref = (query: string) => `#q=${encodeURIComponent(query)}`;

/** A label as its chip, a member with their avatar, as the rest of the app draws them. */
function drawValue({
  option,
  spec,
}: CompletionValue): ValueRowContent | undefined {
  if (spec.kind !== "named") return undefined;
  if (spec.source === "label") {
    const { color } = option as LabelOption;
    return {
      body: (
        <Badge variant="marker" color={color}>
          {option.value}
        </Badge>
      ),
    };
  }
  // The schema's own `@me` until the member search restates it.
  if (spec.source === "member" && "login" in option) {
    const { login } = option as MemberOption;
    return {
      leading: (
        <Avatar size="sm">
          <AvatarFallback>{login.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
      ),
    };
  }
  return undefined;
}

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
        renderValue={drawValue}
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

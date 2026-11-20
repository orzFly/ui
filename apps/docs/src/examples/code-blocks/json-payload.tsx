import request from "@orz/fixtures/json/agent-request.json5?raw";
import { agentTraceSummary, JsonView, parseJson } from "@orz/ui-json";

const parsed = parseJson(request, { dialect: "json5" });

export function JsonPayload() {
  if (!parsed.ok) return null;
  return (
    <JsonView
      document={parsed.document}
      summary={agentTraceSummary}
      maxHeight={360}
    />
  );
}

import alerts from "@orz/fixtures/config/alerts.json?raw";
import deploy from "@orz/fixtures/config/deploy.json?raw";
import flags from "@orz/fixtures/config/flags.json?raw";

export interface ConfigFile {
  name: string;
  /** As last saved; the demo keeps saves in memory, so a reload brings these back. */
  contents: string;
}

// A file ends in a newline on disk; the editor shows it without the empty last line.
export const CONFIG_FILES: readonly ConfigFile[] = [
  { name: "deploy.json", contents: deploy.trimEnd() },
  { name: "alerts.json", contents: alerts.trimEnd() },
  { name: "flags.json", contents: flags.trimEnd() },
];

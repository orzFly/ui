import serviceToml from "@orz/fixtures/config/service.toml?raw";
import { textFile } from "@orz/fixtures/files.ts";
import requestJson5 from "@orz/fixtures/json/agent-request.json5?raw";
import pipelineYaml from "@orz/fixtures/yaml/pipeline.yaml?raw";
import { codeContent } from "@orz/ui-code";
import { Content } from "@orz/ui-content";
import type { FileSource } from "@orz/ui-content/attachment";
import { jsonContent } from "@orz/ui-json/content";
import { tomlContent } from "@orz/ui-json/toml/content";
import { yamlContent } from "@orz/ui-json/yaml/content";
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import type { CSSProperties } from "react";
import { withRenderers, withWidth } from "./decorators.tsx";
import { registrationSnippet } from "./snippets.ts";

const REQUEST = textFile("request.json5", "application/json5", requestJson5);
const PIPELINE = textFile("pipeline.yaml", "application/yaml", pipelineYaml);
const SERVICE = textFile("service.toml", "application/toml", serviceToml);

// The viewer sets the pane's height; on a docs page this stands in for it.
const paneHeight: Decorator = (Story) => (
  <div style={{ "--attachment-pane-height": "28rem" } as CSSProperties}>
    <Story />
  </div>
);

/**
 * `jsonContent`, `yamlContent` and `tomlContent` in the registry: in a viewer, a `.json`,
 * `.jsonc`, `.json5`, `.yaml`, `.yml` or `.toml` file is drawn as a tree, its comments kept. Text that does not parse goes to
 * the next renderer, under the error.
 */
const meta = {
  title: "ui-json/Content",
  parameters: {
    layout: "padded",
    docs: {
      source: {
        code: registrationSnippet({
          renderers: [
            ["@orz/ui-json/content", "jsonContent"],
            ["@orz/ui-code", "codeContent"],
          ],
          uses: [["@orz/ui-content", "Content"]],
          body: '<Content source={file} placement="viewer" />',
        }),
        language: "tsx",
      },
    },
  },
  decorators: [
    paneHeight,
    withWidth("max-w-3xl"),
    withRenderers(jsonContent, yamlContent, tomlContent, codeContent),
  ],
  render: (args) => <Content source={args.source} placement="viewer" />,
} satisfies Meta<{ source: FileSource }>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Json: Story = {
  args: { source: REQUEST },
};

export const Yaml: Story = {
  args: { source: PIPELINE },
  parameters: {
    docs: {
      source: {
        code: registrationSnippet({
          renderers: [
            ["@orz/ui-json/yaml/content", "yamlContent"],
            ["@orz/ui-code", "codeContent"],
          ],
          uses: [["@orz/ui-content", "Content"]],
          body: '<Content source={file} placement="viewer" />',
        }),
        language: "tsx",
      },
    },
  },
};

export const ParseError: Story = {
  tags: ["edge", "!autodocs"],
  args: {
    source: textFile(
      "broken.json",
      "application/json",
      '{\n  "model": "model-large",\n  "stream": true,\n}\n',
    ),
  },
};

export const Toml: Story = {
  args: { source: SERVICE },
  parameters: {
    docs: {
      source: {
        code: registrationSnippet({
          renderers: [
            ["@orz/ui-json/toml/content", "tomlContent"],
            ["@orz/ui-code", "codeContent"],
          ],
          uses: [["@orz/ui-content", "Content"]],
          body: '<Content source={file} placement="viewer" />',
        }),
        language: "tsx",
      },
    },
  },
};

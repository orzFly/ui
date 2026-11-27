import { importOnce } from "./import-once.ts";

// `yaml` and the reader over it are only reached through this import, so a
// bundler splits them into a chunk of their own, fetched the first time YAML
// is read: an app that registers `yamlContent` carries none of it until then.
export const loadYamlReader = importOnce(() => import("./yaml-reader.ts"));

import { importOnce } from "./import-once.ts";

// `toml-eslint-parser` and the reader over it are only reached through this
// import, so a bundler splits them into a chunk of their own, fetched the
// first time TOML is read: an app that registers `tomlContent` carries none of
// it until then.
export const loadTomlReader = importOnce(() => import("./toml-reader.ts"));

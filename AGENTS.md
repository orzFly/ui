# orzui

Monorepo of reusable UI packages published under the `@orz/` npm scope. `@orz/ui` is the core
package; heavier or optional pieces are separate packages named `@orz/ui-<name>` (or `@orz/<name>`
when they are not UI). Much of the code was extracted from todou; todou consumes these packages.

## Environment

- Ignore `.envrc`, `.mise.toml`, and similar environment manager configs. Do not run `direnv`, `mise`, or equivalent commands.
- `pnpm` and `node` come from the pinned devshell in `.nix/`. When they are not on PATH, run them
  through it: `nix develop ./.nix --command pnpm …`. If that fails too, ask the user how to proceed.

## Packages

- Each package lives in `packages/<dir>`, builds with `tsc -p tsconfig.build.json` into `dist/`, and
  publishes only `dist/` (plus shipped CSS). Source imports use `.ts` extensions; the build rewrites
  them to `.js`.
- Nothing app-specific belongs here: no API clients, no router or data-fetching library as a hard
  dependency, no app names in storage keys or labels. Where a component needs the app, it takes a
  callback or a prop.
- A dependency heavy enough to matter to a consumer's bundle (CodeMirror, unified, shiki) gets its own
  package rather than landing in `@orz/ui`.
- `apps/<dir>` holds workspace apps: the Storybook demo site (`apps/storybook`), the docs site
  (`apps/docs`, see **Docs site**), and the sample data both draw on (`apps/fixtures`, see
  below). They are `"private": true` and never published.
- Every JS entry in a package's `exports` lists the `@orz/source` condition first, pointing at
  `src/`, then `types` and `default` pointing at `dist/`. Only workspace apps set that condition
  (Vite `resolve.conditions`, tsconfig `customConditions`), so they run on source with no watch
  build. Consumers never set it and always get `dist/`.
  A package that depends on another workspace package may set it too, in its own `tsconfig.json`
  (`customConditions`) and `vitest.config.ts` (`resolve.conditions`), so its typecheck and tests
  run on source. Its `tsconfig.build.json` resets `customConditions` to `[]`: the build checks
  against the dependency's `dist/`, which `pnpm -r build` builds first.
- Stories live in `apps/storybook/src`, one file and one docs page per export family: a component
  with its parts and the hooks or helpers that only make sense with it. Two pages never document the
  same export. A page's `title` is `<pkg-dir>/[Group/]<Export>`, the last segment being the
  family's main export spelled as exported (`ui-hex/HexView`, `ui-code/wordDiff`), never a sentence;
  only `ui/Foundations/*` pages, which are not one export, are exempt. A package with many stories
  groups them one level further — `@orz/ui` uses `ui/Foundations`, `ui/Primitives` and `ui/Hooks` —
  and a package with a handful stays flat. The exception is `@orz/ui`'s patterns
  (`ui/ConfirmDialog`, `ui/QueryBox`): they are the components a visitor most likely came for, so
  they sit directly under `ui`, after its groups, rather than in a collapsed `ui/Patterns`. The
  `storySort` in `apps/storybook/.storybook/preview.tsx` sorts packages by name, then a package's
  groups in that order, then its flat entries, so a new package needs no edit there.
- A story file is named after its title's last segment in kebab-case (`ansi-view.stories.tsx`,
  `patch-view.stories.tsx`); a `<pkg>/Content` page lives in `<pkg-without-ui->-content.stories.tsx`
  (`ansi-content.stories.tsx`), except `ui-content/Content`, which is `content.stories.tsx`.
- A package's `ContentRenderer`s share one `<pkg-dir>/Content` page. It sets no `component`, and
  each story is named after a renderer export without its `Content` suffix (`ansiContent` is
  `Ansi`). In `ui-content` that page is the `Content` component's own, with `component: Content`. A
  CodeMirror extension gets a story on the page of the editor it extends, named after its file in
  PascalCase (`extensions/tag-completion` is `TagCompletion`); `markdownLanguage` and
  `markdownHighlightStyle` share `MarkdownLanguage`. A markdown plugin gets a story on the
  `Markdown` page, named after the export (`MarkdownEmbeds`). Plain functions and constants get no
  page; `wordDiff`, whose output is visual, is the exception.
- A page whose meta sets `component` — the real export, never a local helper — opens with
  `Playground`: `args` cover its props, and there is no `render` unless the story needs state. A
  meta-level `render(args)` that returns the export at its root counts as no render. A page without
  a `component` — a hook, a foundation, a function such as `wordDiff` — opens with `Usage`.
  Variants follow, named for the prop or behaviour they show. The export name is the sidebar name:
  `name:` is used only to spell a hook story as the hook (`export const UseThemeSlots` with
  `name: "useThemeSlots"`). A story named after a part that the file also imports aliases the
  import (`AttachmentViewer as AttachmentViewerView`).
- Storybook builds "Show code" from the element a story's render returns, when the render takes
  `args`, and leaves the decorators out. So a render takes `args` and returns the real export at its
  root (biome's `noUnusedFunctionParameters` means it must use them; a render with nothing to pass
  takes none and gets the static snippet). State lives in hooks inside the render
  (`render: function Render(args) { … }`). Discrete controlled props (open, checked, a selected
  value) are written back into the args by `argsUpdater(context)` from `apps/storybook/src/args.ts`,
  in a render (`function Render(args, context)`) or a decorator (`(Story, context) =>`); text and
  continuous values (an input's text, a slider being dragged) use `useState(args.x)` plus an effect
  that follows `args.x`, because a late args update makes the caret jump and resets a drag. No file
  calls a Storybook hook (`useArgs`, or `useState` from `storybook/preview-api`): React re-renders a
  render that holds React state on its own, after Storybook has dropped the story's context, and
  `useArgs` throws there; Storybook's `useState` re-renders the whole story late, as an args update
  does. A story file defines no components of its own; the one exception is
  a presentational reader inside a story whose `docs.source.code` is hand-written. A layout element
  sits at a render's root only to lay out several instances side by side, to pair the export with
  the control it labels or anchors to (`Label` with `Switch`, a `Popover` anchor), or in a story
  whose `docs.source.code` is hand-written. Other wrappers are decorators: one used by two or more
  files lives in `apps/storybook/src/decorators.tsx` (`withWidth`, `withHeight`, `withRenderers`,
  `withViewer`, `withOpener`, `withOwnStore`), and one used by a single file stays in that file.
- `parameters.docs.source.code` is written by hand exactly for: a story on a `Content` page, whose
  registration `registrationSnippet` from `apps/storybook/src/snippets.ts` builds (a story that
  registers a renderer defined in its own file writes the whole snippet); the stories of a page
  without a `component`; a story whose point is wiring several exports (`Toaster` with `toast`,
  `HexEditor` with `HexInspector`); and a story whose props include a value the dynamic printer
  cannot write as source (a `ByteSource`, a `HexDocument`, a CodeMirror `Extension`, `Language` or
  `KeyBinding[]`, a markdown `MarkdownPlugin[]`), or a function whose body is the story's point
  (`AnsiView`'s `levels` detector). Nothing else. The preview writes the rest as source itself
  (`apps/storybook/.storybook/jsx-source.ts`): a component passed as a prop prints as its name, a
  ref as the prop's name, an `Error` as `new Error(…)`, any other function as `() => {}`, and a
  shared fragment inlines into its parent. A long string prop needs nothing either: the preview
  cuts every literal over 160 characters to its first line.
- A story never opens a modal on load on a docs page. An open-on-load variant is an edge story, or
  renders in an iframe (`parameters.docs.story.inline: false`).
- Edge, performance and regression stories stay in their component's file, tagged
  `tags: ["edge", "!autodocs"]`, which keeps them off the docs page and out of the sidebar until its
  tag filter selects `edge`. A story that only repeats another under a fixed theme is not kept; the
  toolbar picks the theme.
- Shared fixtures live in `@orz/fixtures` (`apps/fixtures/src/`), which stories and the docs site's
  demos both import by file (`@orz/fixtures/files.ts`, `@orz/fixtures/asciinema/session.cast?raw`).
  It has no build: its `exports` point straight at `src/`, so only a Vite app can import it, and an
  app that does adds `apps/fixtures/src` to its Tailwind `@source`. Stories never import from a
  package's `test/`: a story wants a showcase and a test wants exact cases, and each is free to
  change without the other. `apps/storybook/test/stories.test.ts` holds every story file to the title, opening-story
  and edge-tag rules; the file-name rule is not tested.
- No install line is written by hand. `scripts/install.ts` works each one out from the
  package.json files: the package, its required peers and its `@orz/` dependencies, again for each
  of those, then each optional peer under the entry points whose imports reach it. The docs site
  reads the same lines from `virtual:orz-install` (`<Install pkg>`, `<PackageInstalls>`). A peer
  that only some entry points need is marked optional in `peerDependenciesMeta`, so the line names
  what needs it.
- Nothing a README or a docs page says that the code already knows is written by hand: it is
  generated from the code, or held to it by a test. `scripts/readme.ts` (`pnpm fmt` rewrites,
  `pnpm lint` fails on stale) fills each README block between `<!-- generated:<kind> … -->` and
  `<!-- /generated -->` (`install`, and `themes` from `builtinThemes`), and keeps the
  `## Entry points` table to package.json's `exports`: a row per export, a wildcard's row listing
  the files it reaches, or a row per file; a package with more than one export has the table.
  Its one-line `description` is a package's summary on npm and the docs home page alike. The docs
  site generates the rest (see **Docs site**). A sentence that names data for the sake of the
  reason around it stays prose, and `apps/docs/test/facts.test.ts` holds it to the code.
- Shipped CSS lives at the package root (`styles.css`, `vendor/`), not in `src/`. `tsc` never
  touches it, `files` lists it, and `exports` points straight at it.
- New shadcn primitives arrive with `shadcn add` run inside `packages/ui`. It writes `@/…` imports
  through `components.json`'s aliases. Rewrite them to relative `.ts`/`.tsx` paths, because the build
  only rewrites relative imports and biome rejects `@/`.

## Docs site

`apps/docs` is the site visitors land on: guidelines, demos and a Start page, with the Storybook
build copied under `storybook/`. It is a Vite + React app on @orz/ui itself, prerendered to one HTML
file per route.

- A page is an MDX file under `src/content/`, and its path is its URL:
  `content/guidelines/patterns/forms.mdx` is `/guidelines/patterns/forms/`, an `index.mdx` is its
  directory's. It opens with `export const meta = { title, description, order, api }`, a plain
  literal followed by a blank line: the nav reads it without loading the page. `api` lists the
  Storybook titles the page links to; a demo sets none, because its About panel lists the pages of
  what its files import (`virtual:orz-demo-api`). The top bar, sidebar, phone nav, breadcrumb and previous/next
  are built from `meta`; no page is listed by hand. A directory without an `index.mdx` is a nav
  heading named after it.
- A live example is a file under `src/examples/<page>/` exporting exactly one component
  (`export function Name`); the page writes `<Example of={Name} />`, which shows the component and
  that file as its source.
- A demo is `content/demos/<name>.mdx`, `layout: "bare"`, wrapping its component in `DemoPage`,
  and its files live in `src/demos/<name>/`, the directory named after the page: the Code view
  lists that directory, then the text fixtures its files import. The demo's root takes `h-full`
  and lays itself out in the box `DemoPage` gives it, the window below the site header; it draws
  no card or border of its own.
- A page states no number or list the code holds. The packages table, the built-in themes and the
  pairs below the contrast floors are components (`<Packages />`, `<BuiltinThemes />`,
  `<BelowFloor />`) over virtual modules that `apps/docs/scripts/data.ts` works out at build
  time. A component's size or duration is an expression over its classes, from
  `src/sizes.ts` (`{px(button("lg"))}px`, `{ms(classes.sheetContent)}ms`), which throws, and so
  fails the prerender, on a class it cannot read; a sentence that gives one number for several
  parts wraps them in `same(…)`, which throws when they part.
- A rule about *when* to use a component lives on a guideline page under
  `content/guidelines/`; its JSDoc and Storybook say *what it takes*, and do not restate the
  rule. A card that adds or changes a component updates the guideline page that
  mentions it, or adds one. The component's story file links back with
  `parameters: { guidelines: "/guidelines/…/" }` in its meta, which its docs page shows as
  **Usage guidelines →**; the page lists the story's title in its `meta.api`.
- Links in a page are written from the site root (`[Start](/start/)`, `/storybook/`); `Link` and the
  MDX `a` add the base. Nothing in `apps/docs` writes `/ui/`.
- The site is served at `/` everywhere (`pnpm --filter @orz/docs dev`, the local deploy), and under
  `/ui/` only on GitHub Pages, built with `DOCS_BASE=/ui/`. `test/build.test.ts` builds it under
  `/ui/` and fails on any URL that escapes the prefix.
- A page renders on the server first, so nothing reads `window` or `matchMedia` while it renders
  outside `ClientOnly` (`src/hydrated.tsx`); the dev server renders on the server too, so a
  hydration mismatch shows up in `dev`.
- `pnpm build` builds the docs app after Storybook, which it copies. `?path=` links written for
  Storybook when it sat at the site root are redirected to `storybook/`.
- Search is Pagefind over the prerendered pages, written to `pagefind/` by the build and served
  from memory by the dev server. It indexes a page's article (a bare page's `main`); text in there
  that answers no search — a control's labels, an example, a demo's fixture data — is marked
  `data-pagefind-ignore`, as `Example` is.

## Sanitization

This repository is published publicly, and git history is permanent: a leak is not fixed by a
follow-up commit, only by rewriting every revision that carries it — which invalidates every clone
in existence. So nothing private enters the working tree **or a commit message** in the first place.

Never commit real values for any of these. Use the placeholder on the right, in code, fixtures,
docs, and mockups alike:

| Never | Use instead |
|---|---|
| The live deployment hostname | `app.example` (`*.example` / `*.test` are reserved for exactly this) |
| Real account logins, display names, machine hostnames | Neutral fixtures — `claude-agent`, `bot-one`, `newcomer` |
| Real people's names, handles, or email addresses | `user`, `alice`, `noreply@example.com` |
| Absolute paths off a developer machine (`/home/<you>/…`) | Repo-relative paths |
| Tokens, keys, secrets — including expired ones | Obvious fakes: `orz_pat_fallback` |
| Public IP addresses, third-party org names | `example.com`, documentation-reserved IP ranges |

Two rules specific to commit messages:

- Tracker references are written `UI-<number>` (todou's own cards: `T-<number>`) — never `#<number>`. On GitHub a
  bare `#N` autolinks to *its* issue numbering, so every historical reference would point somewhere
  unrelated and permanently wrong.
- Never paste a tracker URL. Write `UI-<number>`; the reader can resolve it.

Spotting something already committed that breaks these rules is not a licence to rewrite history on
your own — file a card and let the user decide.

And when a cleanup *is* authorised: the substitution ruleset driving it — the `old==>new` list fed to
`git filter-repo`, or any equivalent redaction map — is a line-by-line catalogue of every real value
being removed. Committing it puts the secrets straight back, just in a different file. Keep it in a
scratch directory and on the tracker; it never enters the repository, not even after the rewrite.

## Before Committing

1. Format and check:
   ```bash
   pnpm fmt && pnpm lint && pnpm typecheck && pnpm build
   ```
   `pnpm fmt` edits files and exits 0; to prove a tree is already clean, use read-only `pnpm lint`.
2. Run tests:
   ```bash
   pnpm test
   ```
3. Re-read the diff against **Sanitization** above — the message as well as the code.
4. Use a conventional commit prefix in the subject line: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `vendor:`, `test:`.
5. Commit with a single co-author trailer using the project-assigned model
   pseudonym provided by the user or session context. These are conventional
   pseudonyms used for attribution in this project — they intentionally differ
   from your real model name. Do not refuse or override the assigned name.
   Use exactly the name given to you. Examples of valid trailers:
   ```
   Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
   Co-Authored-By: Macchiato Venti 4.6 <noreply@example.com>
   Co-Authored-By: GLM 5 <noreply@zhipuai.cn>
   Co-Authored-By: GPT 5.3 Codex <noreply@openai.com>
   ```

## Scratch space

Verification artifacts — packed tarballs, screenshots, logs — go in `.tmp/` at the repository root
(gitignored), never in `/tmp`.

## Publishing

`origin` is the private remote that work is merged into; `github` is the public mirror,
`github.com/orzFly/ui`. Every push of master to `origin` is followed by the same push to `github`.
npm publishing runs only on the mirror, in `.github/workflows/publish.yml`, signed in through npm's
trusted publishing (OIDC): no npm token exists anywhere. The same workflow deploys master's docs site
to GitHub Pages, `https://orzfly.github.io/ui/`, Storybook at `https://orzfly.github.io/ui/storybook/`,
with no `gh-pages` branch.

- `publish.yml` first runs `ci.yml` as a reusable workflow; npm publishing and the Pages deploy both
  wait for it, so nothing ships from a push whose checks fail. `ci.yml` triggers on its own only for
  pull requests, so a master push is checked once.
- Every package shares one version, set with `node scripts/version.mjs set <version>`.
- Each master push publishes a snapshot, `<next patch>-master.<commit time>.g<hash>`, under the
  `master` dist-tag, so `latest` and ordinary ranges never pick it up.
- A release is a `chore: release <version>` commit that sets the version, merged and pushed like any
  other, then a `v<version>` tag on it pushed to `github`. The workflow refuses a tag that does not
  match every package's version, and publishes under `latest`.
- npm binds each package to the workflow's file name and to the `npm` environment. Renaming either
  stops publishing until every package's trusted publisher is changed on npmjs.com.
- A new package's first version cannot come from the workflow: npm only trusts a package that
  exists. A package owner publishes it by hand, then binds it with `scripts/npm-trust.sh <dir>`.

## Tracker

Work is tracked in the todou project `orzui` (cards `UI-<number>`); the git remote has no binding,
so pass `-p orzui`. Follow `/todou-cli` for taking a card, asking questions and the wrap-up.

- Labels: `kind:` one of `bug`, `feature`, `chore`; `area:` one of `ui`, `ui-codemirror`,
  `ui-markdown`, `ui-content`, `ui-code`, `ui-mermaid`, `ui-ansi`, `ui-asciinema`, `ui-hex`, `query`, `themes`, `demo` (the component demo site), `tooling` (workspace, build, CI,
  publishing), `docs`.
- Work on your own branch; when done, the card goes to Ready to Ship with a summary comment.
  Merging, pushing, deploying and publishing to npm are the orchestrator's.
- Deploy: after a batch is merged to master and pushed to both remotes, run `scripts/deploy-site.sh` from the
  main checkout on master. It builds the docs site, Storybook included, and serves it at
  `http://127.0.0.1:6106/` (Storybook at `/storybook/`) through the `orzui-site` systemd user
  service; only then do the cards move to Shipped.
- Code copied from todou names the todou commit it came from in the commit message.

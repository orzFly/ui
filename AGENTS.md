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
- `apps/<dir>` holds workspace apps, such as the Storybook demo site. They are `"private": true` and
  never published.
- Every JS entry in a package's `exports` lists the `@orz/source` condition first, pointing at
  `src/`, then `types` and `default` pointing at `dist/`. Only workspace apps set that condition
  (Vite `resolve.conditions`, tsconfig `customConditions`), so they run on source with no watch
  build. Consumers never set it and always get `dist/`.
  A package that depends on another workspace package may set it too, in its own `tsconfig.json`
  (`customConditions`) and `vitest.config.ts` (`resolve.conditions`), so its typecheck and tests
  run on source. Its `tsconfig.build.json` resets `customConditions` to `[]`: the build checks
  against the dependency's `dist/`, which `pnpm -r build` builds first.
- A story's `title` starts with the package its component comes from, by directory name:
  `ui-hex/HexView`, `ui-content/Attachment`. A package with many stories groups them one level
  further — `@orz/ui` uses `ui/Foundations`, `ui/Primitives` and `ui/Hooks` — and a package with a
  handful stays flat. The exception is `@orz/ui`'s patterns (`ui/ConfirmDialog`, `ui/QueryBox`):
  they are the components a visitor most likely came for, so they sit directly under `ui`, after
  its groups, rather than in a collapsed `ui/Patterns`. The `storySort` in
  `apps/storybook/.storybook/preview.tsx` sorts packages by name, then a package's groups in that
  order, then its flat entries, so a new package needs no edit there.
- Shipped CSS lives at the package root (`styles.css`, `vendor/`), not in `src/`. `tsc` never
  touches it, `files` lists it, and `exports` points straight at it.
- New shadcn primitives arrive with `shadcn add` run inside `packages/ui`. It writes `@/…` imports
  through `components.json`'s aliases. Rewrite them to relative `.ts`/`.tsx` paths, because the build
  only rewrites relative imports and biome rejects `@/`.

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

## Tracker

Work is tracked in the todou project `orzui` (cards `UI-<number>`); the git remote has no binding,
so pass `-p orzui`. Follow `/todou-cli` for taking a card, asking questions and the wrap-up.

- Labels: `kind:` one of `bug`, `feature`, `chore`; `area:` one of `ui`, `ui-codemirror`,
  `ui-markdown`, `ui-content`, `ui-code`, `ui-mermaid`, `ui-ansi`, `ui-asciinema`, `ui-hex`, `query`, `themes`, `demo` (the component demo site), `tooling` (workspace, build, CI,
  publishing), `docs`.
- Work on your own branch; when done, the card goes to Ready to Ship with a summary comment.
  Merging, pushing, deploying and publishing to npm are the orchestrator's.
- Deploy: after a batch is merged to master and pushed, run `scripts/deploy-storybook.sh` from the
  main checkout on master. It builds the Storybook site and serves it at `http://127.0.0.1:6106/`
  through the `orzui-storybook` systemd user service; only then do the cards move to Shipped.
- Code copied from todou names the todou commit it came from in the commit message.

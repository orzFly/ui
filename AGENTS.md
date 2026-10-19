# orzui

Monorepo of reusable UI packages published under the `@orz/` npm scope. `@orz/ui` is the core
package; heavier or optional pieces are separate packages named `@orz/ui-<name>` (or `@orz/<name>`
when they are not UI). Much of the code was extracted from todou; todou consumes these packages.

## Environment

- Ignore `.envrc`, `.mise.toml`, and similar environment manager configs. Do not run `direnv`, `mise`, or equivalent commands.
- If `pnpm` commands fail (e.g. toolchain not found), ask the user how to proceed.

## Packages

- Each package lives in `packages/<dir>`, builds with `tsc -p tsconfig.build.json` into `dist/`, and
  publishes only `dist/` (plus shipped CSS). Source imports use `.ts` extensions; the build rewrites
  them to `.js`.
- Nothing app-specific belongs here: no API clients, no router or data-fetching library as a hard
  dependency, no app names in storage keys or labels. Where a component needs the app, it takes a
  callback or a prop.
- A dependency heavy enough to matter to a consumer's bundle (CodeMirror, unified, shiki) gets its own
  package rather than landing in `@orz/ui`.

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

- Tracker references are written `T-<number>` — never `#<number>`. On GitHub a
  bare `#N` autolinks to *its* issue numbering, so every historical reference would point somewhere
  unrelated and permanently wrong.
- Never paste a tracker URL. Write `T-<number>`; the reader can resolve it.

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

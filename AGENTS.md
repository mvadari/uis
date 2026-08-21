# AGENTS.md

This file provides guidance to coding agents (Claude Code, Codex, Cursor, …) when working with code
in this repository. `CLAUDE.md` is a symlink to this file.

## What this is

A collection of standalone browser tools, each a single self-contained HTML file at the repo root
(`github.html`, `pr.html`, `ui.html`, …). No build step, no framework, no bundler, no package.json.
`index.html` is the launcher that links to all of them. Pushing to `main` deploys the repo root
verbatim to GitHub Pages via `.github/workflows/deploy.yml`.

`chrome-extension/` is the one exception to the single-file rule: an unpacked MV3 extension that
opens the current GitHub PR in `pr.html`. It has its own README covering install and Firefox/AMO
signing.

## Commands

There is no test suite, no linter beyond prettier, and nothing to build.

```bash
python3 -m http.server 8000
```

Serve the repo and visit `http://localhost:8000`. Opening a file with `open foo.html` works too,
but `file://` breaks anything reading `?query` params or fetching a sibling file, so prefer the
server.

```bash
npx --no-install prettier --write github.html
```

Formatting is enforced by pre-commit (`prettier --write --ignore-unknown` via the _system_ prettier,
plus whitespace/EOL hooks). Config: 4-space tabs, 100 columns, single quotes. Run prettier before
committing or the hook will reformat and abort the commit.

## Architecture

**Each tool is one file.** Inline `<style>` and inline `<script>`, in that order, inside a single
HTML document. Files run 1000–6000 lines; `github.html` and `pr.html` are the big ones. Adding a
feature means editing three separate regions of the same file: the CSS block, the HTML markup, and
the script block.

**Colours go through CSS custom properties.** `shared-styles.css` defines the palette in `:root`
(`--color-canvas-default`, `--color-fg-muted`, `--color-border-default`, …) and overrides _only those
tokens_ in its `@media (prefers-color-scheme: dark)` block. A component styled with `var(--color-…)`
gets dark mode for free — reach for a raw hex only when no token fits, and then add a token rather
than a dark-mode rule. `pr.html` adds four `--color-diff-*` tokens of its own; `github.html`
deliberately keeps a larger palette inline (its `--color-canvas-default` means an elevated surface,
not the page background), and because the inline `<style>` comes after the linked stylesheet, its
definitions win. `release-tracker.html`, `json-table.html` and `stacked.html` still use raw hexes.

**Two shared files**, included by every tool except `index.html` (which is just the launcher).
`stacked.html` loads `shared-utils.js` but keeps its own CSS:

- `shared-styles.css` — the colour tokens, plus `.btn`, `.modal`, `.toast`, `.card`, `.badge`,
  `.spinner`, `.token-pill`, `.status-line`, `.status-controls`, `.empty-state`/`.loading-state`
- `shared-utils.js` — `showToast`, `escapeHtml`, `timeAgo`/`timeAgoShort`, `formatDate`, `debounce`,
  `getQueryParam`/`setQueryParam`, `copyToClipboard`, the `Storage` and `Modal` objects, and the
  GitHub layer: `getGitHubToken`/`setGitHubToken`/`GITHUB_TOKEN_KEY`, `githubHeaders`,
  `githubRequest`, `mapWithConcurrency`, `normalizeRepo`/`parseRepo`, and
  `setAutoRefresh`/`AUTO_REFRESH_INTERVAL`

`escapeHtml` escapes quotes as well as tags, so it's safe in attribute values too — there is no
separate `escapeAttribute`.

**Watch for redeclarations.** These are classic scripts sharing one global lexical scope, so a
top-level `const`/`let` in `shared-utils.js` whose name a tool also declares is a _fatal_
`SyntaxError` that breaks the whole tool — not a shadowing warning. Before adding a top-level
`const` to `shared-utils.js`, grep the tools for the name. (Top-level `function` declarations are
fine; the tool's copy just wins.)

Some tools define their own local equivalent instead of using the shared one — sometimes
deliberately (`github.html`'s `showNotification`, `ui.html`'s `showToast`, which renders into its
own container with an icon and close button), sometimes just because nobody wired the shared one
up. Prefer the shared version in a file that already loads `shared-utils.js`, and match the
surrounding file when you don't.

**The scripts are classic scripts, not modules.** Top-level `function` declarations land on
`window`; top-level `let`/`const` do **not** — they're script-scoped and unreachable from the
console or from injected JS. This matters when debugging: you can call `renderPRs()` from the
console but you cannot assign to `allPRs`.

**State lives in localStorage.** Every tool namespaces its own keys (`github_pr_labels`,
`github_pr_cache`, `github_pr_notes`, …) with one deliberate exception: **`github_token` is shared
across all the GitHub tools**, so a token entered in one works in the others. The GitHub tools also
cache their last API response plus a timestamp, render from cache immediately on load, then refresh
in the background (5-minute auto-refresh).

**GitHub API access** is `fetch` against `api.github.com` with `Authorization: token ${token}`. Most
tools use REST. `pr.html` uses GraphQL when a token is present (needed for review-thread resolved
state and for reply/resolve/hide mutations) and falls back to read-only REST without one. After a
successful mutation, the pattern is: update the in-memory array from the API response, rewrite the
localStorage cache, then re-render — no refetch.

**Cross-tool links** are plain URLs with query params: `github.html` cards link to
`pr.html?pr=owner/repo/number`, and `pr.html` auto-loads whatever is in `?pr=`. `release-tracker.html`
takes `?repo=`. Keep these params stable; the Chrome extension depends on `pr.html?pr=`.

New tools need a card added to `index.html` and a section in `README.md` — neither is generated.

## Verifying changes

There's no test framework, so verify in a browser. For the GitHub tools this is awkward because they
gate on a valid token and live API data. The approach that works:

1. Copy the tool into the scratchpad alongside `shared-styles.css` and `shared-utils.js`, and inject
   a test hook that assigns the script-scoped state (see above — you can't reach it otherwise):
   `window.__setPRs = (prs) => { allPRs = prs; renderPRs(); };`
2. Serve that directory and stub `window.fetch` from the console to return canned API responses,
   asserting on the requests the tool makes (method, URL, body) and on the resulting DOM.

Clipboard writes fail in an unfocused browser pane (`Document is not focused`) — stub
`navigator.clipboard.writeText` to capture the text instead of testing the real write.

## Conventions

- Commit messages are `<file>: <what changed>`, e.g. `github.html: add milestone editing`. Commits
  go directly to `main`.
- The README is user-facing and lists each tool's features as bullets; update the relevant section
  when adding a user-visible feature.
- Keep tools dependency-free where possible. The only external scripts are CDN loads in the XRPL
  tools (`xrpl.js`, CodeMirror) and `marked` in `xrpld.html`.

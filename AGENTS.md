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
the script block. Dark mode lives in one `@media (prefers-color-scheme: dark)` block near the end of
the CSS — new components need an entry there unless they inherit from a styled ancestor.

**Two shared files**, included by most (not all — `index.html` and `stacked.html` skip them) tools:

- `shared-styles.css` — `.btn`, `.modal`, `.toast`, `.card`, `.badge`, `.spinner`
- `shared-utils.js` — `showToast`, `escapeHtml`, `timeAgo`, `debounce`, `getQueryParam`/`setQueryParam`,
  `copyToClipboard`, and the `GitHubAPI`, `Storage`, `Modal` objects

Tools frequently define their own local equivalent instead of using the shared one (`github.html`
has `showNotification` and `getStoredToken`; `pr.html` has its own `TOKEN_KEY`). Match whatever the
file you're editing already does rather than importing the shared version into a file that isn't
using it.

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

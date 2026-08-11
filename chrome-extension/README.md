# Open in pr.html

A small Chrome extension that opens the GitHub pull request you're looking at in
[pr.html](../pr.html), the PR comment viewer.

`pr.html` auto-loads whatever is in its `pr` query param, so the extension just rewrites
`https://github.com/owner/repo/pull/123` into
`https://mvadari.github.io/uis/pr.html?pr=owner/repo/123` and opens it in a new tab.

## Install

1. Go to `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this `chrome-extension/` directory.

It's unpacked-only — no store submission needed for personal use.

## Use

- **Toolbar icon** — click it while on a PR page (any sub-tab: Files changed, Commits, a
  comment permalink).
- **Keyboard** — `Alt+P` by default. Change it at `chrome://extensions/shortcuts`.
- **Right-click a PR link** — "Open in pr.html", so you can jump straight from a PR list
  or a linked reference in a comment without loading the PR first.

Nothing happens on non-PR pages; that's intentional.

## Options

Right-click the icon → **Options** to point at a different `pr.html`, e.g. a local copy
served over HTTP:

```
http://localhost:8000/pr.html
```

Note that `pr.html` keeps your GitHub token in `localStorage`, which is per-origin — a
different origin means re-entering the token there.

## Permissions

- `activeTab` — read the current tab's URL when you click the icon. No host permissions,
  so the extension can't see any page unless you invoke it.
- `contextMenus` — the right-click entry.
- `storage` — remembers the configured `pr.html` URL.

## Icons

`icons/*.png` are generated from the same gradient as [favicon.svg](../favicon.svg). Chrome
requires raster icons, so they're checked in rather than built.

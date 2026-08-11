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

### Firefox

The manifest carries what Firefox needs, all of it ignored by Chrome:

- `background.scripts` alongside `service_worker` — Firefox
  [doesn't support](https://bugzil.la/1573659) `service_worker` and ignores the key when `scripts`
  is present. `web-ext lint` warns about the ignored key; that's expected, it's what keeps one
  folder working in both browsers.
- `browser_specific_settings.gecko.id` — required by Firefox's `storage.sync` implementation.
- `gecko.data_collection_permissions: {required: ["none"]}` — AMO's data-disclosure declaration.
  This extension collects nothing.
- `gecko.strict_min_version: "142.0"` — the floor for `data_collection_permissions` (Firefox 140
  desktop, 142 Android). Lower it if you need older Firefox and don't mind the lint warnings.

For a quick throwaway test, load it at `about:debugging#/runtime/this-firefox` → **Load Temporary
Add-on** → pick `manifest.json`. That's wiped on restart, so for day-to-day use sign it instead.

#### Permanent install (signed, release Firefox)

Release Firefox won't permanently install an unsigned extension — `xpinstall.signatures.required`
is inert outside Developer Edition / Nightly / ESR, and
[bug 1298806](https://bugzilla.mozilla.org/show_bug.cgi?id=1298806) to change that is WONTFIX. The
way around it is an **unlisted** AMO submission: free, automated validation only (no human review),
and it yields a signed `.xpi` you install like any other add-on.

1. Generate an API key at [addons.mozilla.org/developers/addon/api/key/](https://addons.mozilla.org/en-US/developers/addon/api/key/).
2. Bump `version` in `manifest.json` — AMO rejects a version it has already seen.
3. Sign, from this directory (`web-ext-config.cjs` keeps repo-only files out of the package):

    ```bash
    cd chrome-extension && npx --yes web-ext sign --channel=unlisted --api-key="$AMO_JWT_ISSUER" --api-secret="$AMO_JWT_SECRET"
    ```

4. Install the `.xpi` that lands in `web-ext-artifacts/` via `about:addons` → gear →
   **Install Add-on From File**.

Unlisted add-ons have no auto-update path unless you host the `.xpi` yourself and add an
`update_url`, so repeat steps 2–4 whenever you change something.

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

# UIS - User Interface Suite

A collection of standalone web-based tools that run entirely in your browser.

🔗 **Live Site**: [https://mvadari.github.io/uis/](https://mvadari.github.io/uis/)

## Tools

### 🔗 XRPL Network UI

Comprehensive interface for interacting with the XRP Ledger blockchain.

**Features:**

- Connect to multiple XRPL networks (Mainnet, Testnet, Devnet, local)
- Create and manage wallets
- Send WebSocket requests with templates
- Submit and sign transactions
- Integrated network explorer

[**Launch XRPL Network UI →**](https://mvadari.github.io/uis/ui.html)

---

### 🧪 XRPL Batch Testing UI

Specialized testing tool for XRPL Batch transactions.

**Features:**

- Create and manage test wallets
- Build test cases with transaction templates
- Multi-account batch transaction support
- Run tests and generate reports
- Pre-built templates for common patterns

[**Launch Batch Testing UI →**](https://mvadari.github.io/uis/batch-testing-ui.html)

---

### 📋 GitHub PR Dashboard

Kanban-style dashboard for managing GitHub pull requests.

**Features:**

- Organize PRs with customizable Kanban columns
- Track CI status and merge conflicts
- Add notes and flags to PRs
- Filter by repository
- Auto-refresh every 5 minutes
- Update PR branches directly

[**Launch GitHub PR Dashboard →**](https://mvadari.github.io/uis/github.html)

---

### 💬 PR Comments

A clean, focused view of a single pull request's unresolved conversation.

**Features:**

- Load any PR by URL or `owner/repo#number` (shareable via `?pr=` link)
- Shows unresolved inline review threads grouped by file, with code context
- Includes top-level conversation comments and review summaries
- Groups each thread's sub-comments (root + replies) in chronological order
- Reply to threads and mark them resolved/unresolved directly from the view
- Hide comments and review summaries with a reason (spam, off topic, resolved, etc.)
- Bulk-select comments/reviews with checkboxes to hide or unhide many at once
- Filter by file, author, or text; toggle resolved/hidden items and filter outdated threads
- For outdated threads, compare the code when commented against the current version at the PR head
- Sticky section and file headers while scrolling; deep-linkable from the GitHub PR Dashboard
- Works read-only without a token (public PRs via REST); a token adds resolved-state and reply/resolve/hide via GraphQL
- Shares the GitHub token with the other tools

[**Launch PR Comments →**](https://mvadari.github.io/uis/pr.html)

---

### 🔀 Smart Escrow PR Tracker

Track the stacked PRs for the XRPL Smart Escrow feature.

**Features:**

- Visual stack showing PR dependencies with connecting lines
- CI status with links to failed checks
- Approval counts with reviewer names
- Update individual PR branches or all at once (in stack order)
- Auto-refresh every 5 minutes
- Shares GitHub token with PR Dashboard

[**Launch Smart Escrow PR Tracker →**](https://mvadari.github.io/uis/smart-escrow-prs.html)

---

### 🚢 Release Tracker

Track pull requests for a release milestone in any GitHub repository (including private
repos, using a token).

**Features:**

- Works with any `owner/repo` — defaults to XRPLF/rippled, shareable via the `repo` URL param
- Loads releases from the repo's open milestones
- Shows labels, CI status, merge state, and approval count
- Assigns and removes PRs from the selected milestone
- Shares GitHub token with PR Dashboard (enables private repos)

[**Launch Release Tracker →**](https://mvadari.github.io/uis/release-tracker.html)

---

### 🧭 Base Branch PRs

Find pull requests targeting a specific base branch in any repository.

**Features:**

- Search by `owner/repo` and `base:branch_name`
- Shows PR title, number, link, draft state, author, and branch details
- Flags merge conflicts using GitHub PR mergeability
- Shows CI status from check runs and commit statuses, with failed check links
- Lists reviewers, requested reviewers, approvals, and requested changes
- Shares GitHub token with the other GitHub tools

[**Launch Base Branch PRs →**](https://mvadari.github.io/uis/feature-prs.html)

---

### 🔍 XRPL Server Changes

Explore proposed changes to the XRP Ledger server (rippled) in a non-technical friendly interface.

**Features:**

- Browse all open, completed, and rejected proposals
- Filter by category labels (Amendment, API Change)
- Search across all proposals using GitHub's search
- View full proposal details with rendered Markdown descriptions
- See proposal timelines and discussion activity
- GitHub dark mode theming

[**Launch XRPL Server Changes →**](https://mvadari.github.io/uis/xrpld.html)

---

### 📚 Stacked PR Dashboard

Visualize and navigate stacked pull requests in a repository as a DAG (Directed Acyclic Graph).

**Features:**

- Automatically infers PR stacks from branch relationships
- DAG visualization with collapsible branches
- Filter between "My Stacks" and "All Stacks"
- Status indicators for CI, reviews, and mergeability
- Branch names shown on every PR for easy identification
- Quick links for PR comparisons (child vs parent, PR vs base)
- Auto-refresh every 5 minutes with caching
- Shares GitHub token with other tools

[**Launch Stacked PR Dashboard →**](https://mvadari.github.io/uis/stacked.html)

---

### ▦ JSON Table Viewer

Validate and inspect AI-generated JSON arrays as tabular data.

**Features:**

- Checks that the JSON is a top-level list of objects
- Detects exact, close, and mismatched object key sets
- Highlights row-level missing and extra keys
- Renders a table using the union of all keys
- Copies or downloads the result as CSV
- Accepts pasted JSON, fenced JSON blocks, extracted arrays, and local `.json` files

[**Launch JSON Table Viewer →**](https://mvadari.github.io/uis/json-table.html)

---

## Local Development

All tools are self-contained HTML files. To run locally:

1. Clone the repository:

    ```bash
    git clone https://github.com/mvadari/uis.git
    cd uis
    ```

2. Open any HTML file in your browser:
    ```bash
    open index.html
    # or
    open ui.html
    open batch-testing-ui.html
    open github.html
    open smart-escrow-prs.html
    open xrpld.html
    open stacked.html
    open json-table.html
    ```

Alternatively, use a local server:

```bash
python -m http.server 8000
# Then visit http://localhost:8000
```

## Deployment

This project uses GitHub Actions to automatically deploy to GitHub Pages on every push to `main`.

The workflow is defined in `.github/workflows/deploy.yml`.

## Privacy & Security

There are likely no major security risks possible, given the simplicity of the apps.

- All tools run entirely in your browser
- No data is sent to external servers (except API calls to XRPL/GitHub)
- Data is stored locally in your browser's localStorage
- GitHub tokens are stored locally and never transmitted elsewhere

**NOTE:** All the code in this repo is almost entirely vibe-coded.

## License

MIT License - feel free to use and modify as needed.

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests. Responses are not likely to be prioritized, however, as this is mostly just a personal project.

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

- All tools run entirely in your browser
- No data is sent to external servers (except API calls to XRPL/GitHub)
- Data is stored locally in your browser's localStorage
- GitHub tokens are stored locally and never transmitted elsewhere

## License

MIT License - feel free to use and modify as needed.

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.


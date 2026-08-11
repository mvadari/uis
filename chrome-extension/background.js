// Opens the GitHub pull request in the current tab (or under the cursor) in
// pr.html. pr.html auto-loads whatever is in its `pr` query param, so all this
// has to do is reshape the URL.

const DEFAULT_BASE = 'https://mvadari.github.io/uis/pr.html';
const MENU_ID = 'open-in-pr-html';

// Matches github.com/owner/repo/pull/123 plus any sub-path (/files, /commits/abc).
const PR_URL = /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:[/?#]|$)/i;

function toPrHtmlParam(url) {
    const match = PR_URL.exec(url || '');
    if (!match) return null;
    const [, owner, repo, number] = match;
    return `${owner}/${repo.replace(/\.git$/, '')}/${number}`;
}

async function getBaseUrl() {
    const { baseUrl } = await chrome.storage.sync.get('baseUrl');
    return (baseUrl || '').trim() || DEFAULT_BASE;
}

async function openInPrHtml(url, openerTabId) {
    const param = toPrHtmlParam(url);
    if (!param) return;
    const base = await getBaseUrl();
    await chrome.tabs.create({
        url: `${base}?pr=${encodeURIComponent(param)}`,
        openerTabId,
    });
}

chrome.action.onClicked.addListener((tab) => {
    openInPrHtml(tab.url, tab.id);
});

chrome.runtime.onInstalled.addListener(() => {
    // Right-clicking a PR link (in a PR list, a comment, anywhere) opens it
    // without having to navigate to the PR first.
    chrome.contextMenus.create({
        id: MENU_ID,
        title: 'Open in pr.html',
        contexts: ['link'],
        targetUrlPatterns: ['*://github.com/*/pull/*', '*://www.github.com/*/pull/*'],
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== MENU_ID) return;
    openInPrHtml(info.linkUrl || info.pageUrl, tab?.id);
});

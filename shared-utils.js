/* ============================================
   SHARED UTILITIES - Common JavaScript for all UI tools
   ============================================ */

// ============================================
// Toast Notifications
// ============================================

function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ============================================
// GitHub API
// ============================================

// One key for every GitHub tool, so a token entered in one works in the others.
const GITHUB_TOKEN_KEY = 'github_token';

function getGitHubToken() {
    return (localStorage.getItem(GITHUB_TOKEN_KEY) || '').trim();
}

// An empty value forgets the token.
function setGitHubToken(token) {
    const trimmed = (token || '').trim();
    if (trimmed) localStorage.setItem(GITHUB_TOKEN_KEY, trimmed);
    else localStorage.removeItem(GITHUB_TOKEN_KEY);
}

function githubHeaders(extra) {
    const token = getGitHubToken();
    return {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(token ? { Authorization: `token ${token}` } : {}),
        ...extra,
    };
}

// fetch plus GitHub's error shape, returning parsed JSON.
async function githubRequest(url, options = {}) {
    const response = await fetch(url, { ...options, headers: githubHeaders(options.headers) });

    if (!response.ok) {
        let message = `GitHub API returned ${response.status}`;
        try {
            const data = await response.json();
            if (data.message) message = data.message;
        } catch {}
        throw new Error(message);
    }

    return response.json();
}

// Run mapper over items with at most `limit` in flight, preserving input order.
// Tools that fan out several requests per PR need this to stay under GitHub's
// secondary (concurrency) rate limit.
async function mapWithConcurrency(items, limit, mapper) {
    const results = new Array(items.length);
    let nextIndex = 0;

    async function worker() {
        while (nextIndex < items.length) {
            const index = nextIndex++;
            results[index] = await mapper(items[index], index);
        }
    }

    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
}

// "owner/repo" from a bare slug or any github.com URL.
function normalizeRepo(value) {
    return String(value || '')
        .trim()
        .replace(/^https?:\/\/github\.com\//i, '')
        .replace(/\.git$/i, '')
        .replace(/\/+$/, '');
}

// -> { owner, repo, slug }, or null if it isn't a repo reference.
function parseRepo(value) {
    const match = normalizeRepo(value).match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
    if (!match) return null;
    return { owner: match[1], repo: match[2], slug: `${match[1]}/${match[2]}` };
}

// ============================================
// Auto Refresh
// ============================================

const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000;

// The page's one background-refresh timer. Always clears the previous timer, so
// toggling the setting repeatedly can't stack duplicates.
const setAutoRefresh = (() => {
    let timer = null;
    return function setAutoRefresh(enabled, callback, intervalMs = AUTO_REFRESH_INTERVAL) {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
        if (enabled) timer = setInterval(callback, intervalMs);
    };
})();

// ============================================
// Time Formatting Utilities
// ============================================

function timeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);

    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60,
    };

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
        }
    }

    return 'just now';
}

// Abbreviated relative time: "just now", "5m ago", "3h ago", "12d ago", falling back to
// an absolute date past 30 days. Complements timeAgo, which spells the units out.
// `absoluteOptions` are toLocaleDateString options for that fallback.
function timeAgoShort(date, absoluteOptions = null) {
    const d = new Date(date);
    const minutes = Math.floor((new Date() - d) / 60000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;

    return absoluteOptions
        ? d.toLocaleDateString('en-US', absoluteOptions)
        : d.toLocaleDateString();
}

function formatDate(date, includeTime = false) {
    const d = new Date(date);
    const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    };

    if (includeTime) {
        options.hour = '2-digit';
        options.minute = '2-digit';
    }

    return d.toLocaleDateString('en-US', options);
}

// ============================================
// HTML Utilities
// ============================================

const HTML_ESCAPES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

// Escapes quotes as well as tags, so the result is safe in an attribute value too.
// A plain string replace rather than a throwaway element: this runs per diff line.
function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

// ============================================
// Storage Utilities
// ============================================

const Storage = {
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error(`Error reading ${key} from storage:`, error);
            return defaultValue;
        }
    },

    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error(`Error writing ${key} to storage:`, error);
            return false;
        }
    },

    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error(`Error removing ${key} from storage:`, error);
            return false;
        }
    },

    clear() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('Error clearing storage:', error);
            return false;
        }
    },
};

// ============================================
// Modal Utilities
// ============================================

const Modal = {
    open(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';

            // Focus first input if available
            const firstInput = modal.querySelector('input, textarea, select');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
        }
    },

    close(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    },

    closeAll() {
        document.querySelectorAll('.modal.active').forEach((modal) => {
            modal.classList.remove('active');
        });
        document.body.style.overflow = '';
    },
};

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        Modal.close(e.target.id);
    }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        Modal.closeAll();
    }
});

// ============================================
// Debounce Utility
// ============================================

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================
// Copy to Clipboard
// ============================================

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('Copied to clipboard', 'success', 2000);
        return true;
    } catch (error) {
        console.error('Copy failed:', error);
        showToast('Failed to copy', 'error', 2000);
        return false;
    }
}

// ============================================
// URL Utilities
// ============================================

function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

function setQueryParam(param, value) {
    const url = new URL(window.location);
    url.searchParams.set(param, value);
    window.history.pushState({}, '', url);
}

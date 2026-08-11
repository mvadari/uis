const DEFAULT_BASE = 'https://mvadari.github.io/uis/pr.html';
const input = document.getElementById('baseUrl');
const status = document.getElementById('status');

chrome.storage.sync.get('baseUrl').then(({ baseUrl }) => {
    input.value = baseUrl || DEFAULT_BASE;
});

document.getElementById('save').addEventListener('click', async () => {
    await chrome.storage.sync.set({ baseUrl: input.value.trim() || DEFAULT_BASE });
    status.textContent = 'Saved';
    setTimeout(() => (status.textContent = ''), 1500);
});

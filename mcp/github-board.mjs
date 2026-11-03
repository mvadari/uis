#!/usr/bin/env node
// MCP server for the github.html board. The columns, notes and flags live in the browser's
// localStorage, so this server can't read them itself: it relays each tool call to an open
// github.html tab (Settings → Preferences → "Connect to the local MCP bridge"). The page listens
// on GET /events (server-sent events) and answers with POST /result.
//
// No dependencies. Stdout carries MCP JSON-RPC, one message per line; logs go to stderr.
//
//   claude mcp add --scope user github-board -- node /path/to/uis/mcp/github-board.mjs

import http from 'node:http';
import readline from 'node:readline';

const PORT = 8765; // github.html has this port too (MCP_BRIDGE_URL)
const CALL_TIMEOUT_MS = 15000;

// Only these pages may connect. Any other site in the browser could otherwise read the board or
// feed Claude fake data.
const ALLOWED_ORIGINS = [
    /^https:\/\/mvadari\.github\.io$/,
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
];

const PR_REF_SCHEMA = {
    type: 'string',
    description: 'A PR as "owner/repo#number", its URL, or the board id from list_prs',
};

const TOOLS = [
    {
        name: 'list_columns',
        description: 'List the board columns with their ids and how many PRs each one holds.',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'list_prs',
        description:
            'List the PRs on the board, optionally only those in one column. Each PR has its ' +
            'column, note, flag, CI status and "owner/repo#number" ref. The board ignores its ' +
            'on-screen filters here. To act on a PR on GitHub (comment, review, merge), use gh ' +
            'with the ref; the board picks up the change on its next refresh.',
        inputSchema: {
            type: 'object',
            properties: {
                column: { type: 'string', description: 'Column name or id (case-insensitive)' },
            },
        },
    },
    {
        name: 'move_prs',
        description: 'Move PRs to a column.',
        inputSchema: {
            type: 'object',
            properties: {
                prs: { type: 'array', items: PR_REF_SCHEMA },
                column: { type: 'string', description: 'Column name or id (case-insensitive)' },
            },
            required: ['prs', 'column'],
        },
    },
    {
        name: 'set_note',
        description: "Set a PR's private note on the board. An empty note removes it.",
        inputSchema: {
            type: 'object',
            properties: { pr: PR_REF_SCHEMA, note: { type: 'string' } },
            required: ['pr', 'note'],
        },
    },
    {
        name: 'set_flag',
        description: 'Flag or unflag a PR on the board.',
        inputSchema: {
            type: 'object',
            properties: { pr: PR_REF_SCHEMA, flagged: { type: 'boolean' } },
            required: ['pr', 'flagged'],
        },
    },
];

// Bridge to the page. The newest open tab gets every call, so two open tabs can't both apply a
// move. When it closes, calls fall back to the next newest.
const pages = [];
let listenError = null;
let nextCallId = 1;
const pendingCalls = new Map();

function callPage(method, params) {
    if (listenError) {
        return Promise.reject(new Error(`The bridge can't listen on port ${PORT}: ${listenError}`));
    }
    const page = pages.at(-1);
    if (!page) {
        return Promise.reject(
            new Error(
                'No github.html tab is connected. Open github.html and turn on Settings → ' +
                    'Preferences → "Connect to the local MCP bridge".',
            ),
        );
    }
    const id = nextCallId++;
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            pendingCalls.delete(id);
            reject(new Error('github.html did not answer in time.'));
        }, CALL_TIMEOUT_MS);
        pendingCalls.set(id, { resolve, reject, timer });
        page.write(`data: ${JSON.stringify({ id, method, params })}\n\n`);
    });
}

const server = http.createServer((req, res) => {
    const origin = req.headers.origin || '';
    if (!ALLOWED_ORIGINS.some((pattern) => pattern.test(origin))) {
        res.writeHead(403).end();
        return;
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Private-Network', 'true');

    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.writeHead(204).end();
    } else if (req.method === 'GET' && req.url === '/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
        res.write(': connected\n\n');
        pages.push(res);
        console.error(`github.html connected from ${origin}`);
        req.on('close', () => pages.splice(pages.indexOf(res), 1));
    } else if (req.method === 'POST' && req.url === '/result') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
            try {
                const { id, result, error } = JSON.parse(body);
                const call = pendingCalls.get(id);
                if (call) {
                    pendingCalls.delete(id);
                    clearTimeout(call.timer);
                    if (error) call.reject(new Error(error));
                    else call.resolve(result);
                }
                res.writeHead(204).end();
            } catch {
                res.writeHead(400).end();
            }
        });
    } else {
        res.writeHead(404).end();
    }
});

// A second copy of this server (another Claude session) can't bind the port. It stays up so the
// session starts, and its tool calls report why they fail.
server.on('error', (error) => {
    listenError = error.code || error.message;
    console.error(`github-board bridge: ${listenError}`);
});
server.listen(PORT, '127.0.0.1');

// MCP over stdio
function send(message) {
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n');
}

async function handle(message) {
    const { id, method, params } = message;
    if (id === undefined) return; // notification

    if (method === 'initialize') {
        send({
            id,
            result: {
                protocolVersion: params?.protocolVersion || '2025-06-18',
                capabilities: { tools: {} },
                serverInfo: { name: 'github-board', version: '1.0.0' },
            },
        });
    } else if (method === 'ping') {
        send({ id, result: {} });
    } else if (method === 'tools/list') {
        send({ id, result: { tools: TOOLS } });
    } else if (method === 'tools/call') {
        try {
            const result = await callPage(params.name, params.arguments || {});
            send({
                id,
                result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] },
            });
        } catch (error) {
            send({
                id,
                result: { content: [{ type: 'text', text: error.message }], isError: true },
            });
        }
    } else {
        send({ id, error: { code: -32601, message: `Method not found: ${method}` } });
    }
}

readline.createInterface({ input: process.stdin }).on('line', (line) => {
    if (!line.trim()) return;
    try {
        handle(JSON.parse(line));
    } catch {
        send({ id: null, error: { code: -32700, message: 'Parse error' } });
    }
});
process.stdin.on('end', () => process.exit(0));

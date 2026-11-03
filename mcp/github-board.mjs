#!/usr/bin/env node
// MCP server for the github.html board. The columns, notes and flags live in the browser's
// localStorage, so this server can't read them itself. Every github.html tab with Settings →
// Preferences → "Connect to the local MCP bridge" on long-polls POST /poll with a snapshot of its
// board, and gets back any commands queued since its last poll. Reads answer from the newest
// snapshot (also kept on disk, so they work with no tab open); writes go to every open tab.
//
// Each Claude session starts its own copy. The first to bind the port serves it, and every copy,
// that one included, sends tool calls to POST /call. When the owner exits, the next copy to make
// a call takes the port over.
//
// No dependencies. Stdout carries MCP JSON-RPC, one message per line; logs go to stderr.
//
//   claude mcp add --scope user github-board -- node /path/to/uis/mcp/github-board.mjs

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

const PORT = 8765; // github.html has this port too (MCP_BRIDGE_URL)
const CALL_TIMEOUT_MS = 15000;
const POLL_HOLD_MS = 25000;
const TAB_GONE_MS = POLL_HOLD_MS + 10000; // no poll for this long means no tab is open
const BOARD_FILE = path.join(os.homedir(), '.cache', 'github-board', 'board.json');

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

// Owner state: the newest board snapshot, and the write commands sent to the tabs. A command
// stays in the list for a while after a tab answers, so tabs that poll later apply it too.
let board = null; // { at, columns: [{ id, name }], prs: [...] }
let lastPollAt = 0;
let seq = 0;
let commands = []; // { seq, method, params, at, waiter }
const boot = Math.random().toString(36).slice(2);
const waitingPolls = new Set();

function saveBoard(snapshot) {
    board = { at: new Date().toISOString(), ...snapshot };
    fs.mkdirSync(path.dirname(BOARD_FILE), { recursive: true });
    fs.writeFileSync(BOARD_FILE, JSON.stringify(board), { mode: 0o600 });
}

function findColumn(name) {
    const wanted = String(name).trim().toLowerCase();
    const column = board.columns.find(
        (column) => column.id.toLowerCase() === wanted || column.name.toLowerCase() === wanted,
    );
    if (!column) {
        const names = board.columns.map((column) => column.name).join(', ');
        throw new Error(`No column "${name}". Columns: ${names}`);
    }
    return column;
}

function tabOpen() {
    return Date.now() - lastPollAt < TAB_GONE_MS;
}

function readBoard(method, params) {
    // The file holds the last snapshot from whichever copy served before this one.
    if (!board) {
        try {
            board = JSON.parse(fs.readFileSync(BOARD_FILE, 'utf8'));
        } catch {}
    }
    if (!board) {
        throw new Error(
            'No board yet. Open github.html and turn on Settings → Preferences → ' +
                '"Connect to the local MCP bridge".',
        );
    }
    const meta = { as_of: board.at, tab_open: tabOpen() };
    if (method === 'list_columns') {
        return {
            ...meta,
            columns: board.columns.map((column) => ({
                ...column,
                count: board.prs.filter((pr) => pr.column === column.name).length,
            })),
        };
    }
    const column = params.column ? findColumn(params.column).name : null;
    return { ...meta, prs: board.prs.filter((pr) => !column || pr.column === column) };
}

function answerPoll(res, pending) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const sent = pending.map(({ seq, method, params }) => ({ seq, method, params }));
    res.end(JSON.stringify({ boot, seq, commands: sent }));
}

function writeBoard(method, params) {
    if (!tabOpen()) {
        throw new Error(
            "No github.html tab is open, so the board can't change. Open github.html with " +
                'Settings → Preferences → "Connect to the local MCP bridge" on.',
        );
    }
    const command = { seq: ++seq, method, params, at: Date.now() };
    // Commands older than a minute have reached every tab that is going to poll.
    commands = commands.filter((old) => Date.now() - old.at < 60000).concat(command);
    for (const poll of waitingPolls) poll.flush();
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            command.waiter = null;
            reject(new Error('github.html did not answer in time.'));
        }, CALL_TIMEOUT_MS);
        command.waiter = { resolve, reject, timer };
    });
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (error) {
                reject(error);
            }
        });
    });
}

async function handleCall(req, res) {
    let reply;
    try {
        const { name, args } = await readBody(req);
        const read = name === 'list_columns' || name === 'list_prs';
        reply = { result: await (read ? readBoard(name, args) : writeBoard(name, args)) };
    } catch (error) {
        reply = { error: error.message };
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(reply));
}

async function handlePoll(req, res) {
    const { boot: tabBoot, after, board: snapshot } = await readBody(req);
    lastPollAt = Date.now();
    if (snapshot) saveBoard(snapshot);
    // A tab new to this server (it just opened, or the server restarted) gets only the commands
    // nobody has answered yet; replaying answered ones could undo later changes.
    const known = tabBoot === boot;
    const pending = known
        ? commands.filter((c) => c.seq > after)
        : commands.filter((c) => c.waiter);
    if (pending.length > 0) return answerPoll(res, pending);

    const from = known ? after : seq;
    const poll = {
        flush: () => {
            clearTimeout(timer);
            waitingPolls.delete(poll);
            answerPoll(
                res,
                commands.filter((c) => c.seq > from),
            );
        },
    };
    const timer = setTimeout(poll.flush, POLL_HOLD_MS);
    waitingPolls.add(poll);
    res.on('close', () => {
        clearTimeout(timer);
        waitingPolls.delete(poll);
    });
}

async function handleResult(req, res) {
    const { seq: commandSeq, result, error } = await readBody(req);
    const command = commands.find((c) => c.seq === commandSeq);
    // The first tab to answer decides the result; the others just apply the change.
    if (command?.waiter) {
        clearTimeout(command.waiter.timer);
        if (error) command.waiter.reject(new Error(error));
        else command.waiter.resolve(result);
        command.waiter = null;
    }
    res.writeHead(204).end();
}

const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    try {
        // /call comes from this script's copies, never a browser: browsers always send Origin on a
        // POST, and the custom header makes them ask first, which the OPTIONS reply refuses.
        if (req.url === '/call') {
            if (origin || req.headers['x-github-board'] !== '1') return res.writeHead(403).end();
            return await handleCall(req, res);
        }
        // Only these pages may connect. Any other site in the browser could otherwise read the
        // board or feed Claude fake data.
        if (!ALLOWED_ORIGINS.some((pattern) => pattern.test(origin || ''))) {
            return res.writeHead(403).end();
        }
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Private-Network', 'true');
        if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Methods', 'POST');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.writeHead(204).end();
        } else if (req.method === 'POST' && req.url === '/poll') {
            await handlePoll(req, res);
        } else if (req.method === 'POST' && req.url === '/result') {
            await handleResult(req, res);
        } else {
            res.writeHead(404).end();
        }
    } catch {
        if (!res.headersSent) res.writeHead(400).end();
    }
});

// Resolves true when this copy now owns the port, false when another process holds it.
function listen() {
    return new Promise((resolve, reject) => {
        const onError = (error) => {
            server.off('listening', onListening);
            if (error.code === 'EADDRINUSE') resolve(false);
            else reject(error);
        };
        const onListening = () => {
            server.off('error', onError);
            console.error(`github-board: serving the bridge on port ${PORT}`);
            resolve(true);
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(PORT, '127.0.0.1');
    });
}

async function postCall(name, args) {
    const response = await fetch(`http://127.0.0.1:${PORT}/call`, {
        method: 'POST',
        headers: { 'X-Github-Board': '1' },
        body: JSON.stringify({ name, args }),
    });
    const reply = await response.json();
    if (reply.error) throw new Error(reply.error);
    return reply.result;
}

let listening = listen();
listening.catch((error) => console.error(`github-board: ${error.message}`));

async function callBoard(name, args) {
    await listening;
    try {
        return await postCall(name, args);
    } catch (error) {
        if (error.cause?.code !== 'ECONNREFUSED') throw error;
    }
    // Nobody serves the port any more: take it over, or use whoever beat us to it.
    listening = listen();
    await listening;
    return postCall(name, args);
}

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
            const result = await callBoard(params.name, params.arguments || {});
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

// Minimal static file server that never calls process.cwd().
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = '/Users/mvadari/Documents/uis';
const PORT = 8200;

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.json': 'application/json; charset=utf-8',
};

http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel === '/' || rel === '') rel = '/index.html';
    const filePath = path.join(ROOT, path.normalize(rel));
    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }
        res.writeHead(200, {
            'Content-Type': TYPES[path.extname(filePath)] || 'application/octet-stream',
        });
        res.end(data);
    });
}).listen(PORT, () => console.log(`static server on http://localhost:${PORT}`));

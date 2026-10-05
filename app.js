'use strict';

const fs = require('fs');
const path = require('path');
const { computeDiff, formatInline, hunkGroups, formatUnified } = require('./diff.js');

const PUBLIC_DIR = path.join(__dirname, 'public');
const ROOT_FILES = new Map([['/diff.js', 'diff.js']]);

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const { pathname } = url;
  const method = req.method;

  if (method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': '*', 'Content-Length': '0' });
    res.end();
    return;
  }

  if (method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
    const file = path.join(PUBLIC_DIR, 'index.html');
    if (!fs.existsSync(file)) return sendJson(res, 404, { ok: false, error: 'index.html missing' });
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(file, 'utf8'));
    return;
  }

  if (method === 'GET' && ROOT_FILES.has(pathname)) {
    const file = path.join(__dirname, ROOT_FILES.get(pathname));
    if (fs.existsSync(file)) {
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
      res.end(fs.readFileSync(file, 'utf8'));
      return;
    }
    return sendJson(res, 404, { ok: false, error: 'Not found' });
  }

  if (method === 'GET' && pathname === '/health') {
    return sendJson(res, 200, { ok: true });
  }

  if (method === 'POST' && pathname === '/api/diff') {
    let body = '';
    let tooLarge = false;
    req.on('data', (c) => {
      body += c;
      if (body.length > 5e6 && !tooLarge) {
        tooLarge = true;
        req.destroy();
        sendJson(res, 413, { ok: false, error: 'Input too large' });
      }
    });
    req.on('end', () => {
      if (tooLarge) return;
      let data;
      try {
        data = JSON.parse(body || '{}');
      } catch (_) {
        return sendJson(res, 400, { ok: false, error: 'Invalid JSON' });
      }
      const a = data.a == null ? '' : String(data.a);
      const b = data.b == null ? '' : String(data.b);
      const mode = ['lines', 'words', 'chars'].includes(data.mode) ? data.mode : 'lines';
      const context = Number.isInteger(data.context) && data.context >= 0 ? data.context : 3;
      try {
        const result = computeDiff(a, b, {
          mode,
          ignoreCase: !!data.ignoreCase,
          ignoreWhitespace: !!data.ignoreWhitespace,
        });
        const groups = hunkGroups(result.ops, context);
        const unified = formatUnified(result.ops, context, { a: 'old', b: 'new' });
        const inline = mode === 'lines' ? formatInline(a, b) : null;
        return sendJson(res, 200, {
          ok: true,
          stats: result.stats,
          ops: result.ops.map((o) => ({ type: o.type, value: o.value })),
          hunks: groups.length,
          unified,
          inline,
          mode,
        });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    });
    return;
  }

  sendJson(res, 404, { ok: false, error: 'Not found' });
}

module.exports = { handleRequest, sendJson };
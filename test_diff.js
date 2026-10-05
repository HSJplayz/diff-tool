'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const {
  tokenize,
  tokenizeLines,
  tokenizeWords,
  lcsLength,
  lcsSequence,
  diffTokens,
  diffLines,
  computeDiff,
  hunkGroups,
  formatUnified,
  formatInline,
} = require('./diff.js');
const { handleRequest } = require('./app.js');

function mockRes() {
  return {
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    end(body) { this.body = body; },
  };
}

test('tokenize splits by mode', () => {
  assert.deepStrictEqual(tokenizeLines('a\nb\nc'), ['a', 'b', 'c']);
  assert.deepStrictEqual(tokenize('a b', 'words'), ['a', ' ', 'b']);
  assert.deepStrictEqual(tokenize('abc', 'chars'), ['a', 'b', 'c']);
});

test('lcsLength computes the longest common subsequence length', () => {
  assert.strictEqual(lcsLength([1, 2, 3, 4], [2, 4]), 2);
  assert.strictEqual(lcsLength([1, 2, 3], [1, 2, 3]), 3);
  assert.strictEqual(lcsLength([], [1]), 0);
  assert.strictEqual(lcsLength([1], []), 0);
});

test('lcsSequence returns a valid common subsequence', () => {
  const seq = lcsSequence(['a', 'b', 'c'], ['a', 'c']);
  assert.deepStrictEqual(seq, ['a', 'c']);
});

test('diffTokens handles empty sides', () => {
  assert.deepStrictEqual(diffTokens([], []), []);
  assert.strictEqual(diffTokens([], ['a']).length, 1);
  assert.strictEqual(diffTokens(['a'], [])[0].type, 'delete');
});

test('diffTokens marks insertions and deletions', () => {
  const ops = diffTokens(['a'], ['a', 'b']);
  assert.strictEqual(ops.filter((o) => o.type === 'insert').length, 1);
  assert.strictEqual(ops.filter((o) => o.type === 'equal').length, 1);
});

test('diffTokens output reconstructs both inputs', () => {
  const a = ['x', 'y', 'z'];
  const b = ['x', 'q', 'z', 'w'];
  const ops = diffTokens(a, b);
  const rebuiltA = ops.filter((o) => o.type !== 'insert').map((o) => o.value);
  const rebuiltB = ops.filter((o) => o.type !== 'delete').map((o) => o.value);
  assert.deepStrictEqual(rebuiltA, a);
  assert.deepStrictEqual(rebuiltB, b);
});

test('diffTokens is minimal for an insertion in the middle', () => {
  const ops = diffTokens(['a', 'c'], ['a', 'b', 'c']);
  assert.deepStrictEqual(ops.map((o) => o.type), ['equal', 'insert', 'equal']);
});

test('computeDiff identical inputs = 100% similar, no changes', () => {
  const r = computeDiff('hello\nworld', 'hello\nworld');
  assert.strictEqual(r.stats.added, 0);
  assert.strictEqual(r.stats.removed, 0);
  assert.strictEqual(r.stats.similar, 100);
});

test('computeDiff detects a single line change', () => {
  const r = computeDiff('a\nb\nc', 'a\nX\nc');
  assert.strictEqual(r.stats.removed, 1);
  assert.strictEqual(r.stats.added, 1);
  assert.strictEqual(r.stats.unchanged, 2);
});

test('computeDiff respects ignoreCase and ignoreWhitespace', () => {
  assert.strictEqual(computeDiff('Hello', 'hello', { ignoreCase: true }).stats.removed, 0);
  assert.strictEqual(computeDiff('a  b', 'a b', { ignoreWhitespace: true }).stats.removed, 0);
  assert.ok(computeDiff('Hello', 'hello').stats.removed > 0);
});

test('computeDiff words mode works', () => {
  const r = computeDiff('the quick fox', 'the slow fox', { mode: 'words' });
  assert.strictEqual(r.stats.added, 1);
  assert.strictEqual(r.stats.removed, 1);
});

test('empty vs empty is 100% similar', () => {
  const r = computeDiff('', '');
  assert.strictEqual(r.stats.similar, 100);
});

test('hunkGroups separates distant changes and merges nearby ones', () => {
  const ops = computeDiff('a\nb\nc\nd\ne', 'a\nB\nc\nd\nE').ops;
  assert.strictEqual(hunkGroups(ops, 0).length, 2, 'context 0 keeps changes apart');
  assert.strictEqual(hunkGroups(ops, 3).length, 1, 'wide context merges into one');
  assert.strictEqual(hunkGroups(ops.map((o) => ({ ...o, type: 'equal' })), 3).length, 0);
});

test('formatUnified emits headers and +/- lines', () => {
  const ops = computeDiff('a\nb', 'a\nc').ops;
  const out = formatUnified(ops, 3, { a: 'old.txt', b: 'new.txt' });
  assert.ok(out.startsWith('--- old.txt\n+++ new.txt'));
  assert.ok(out.includes('-b'));
  assert.ok(out.includes('+c'));
  assert.ok(out.includes('@@'));
});

test('formatInline marks word changes', () => {
  const out = formatInline('the quick fox', 'the slow fox');
  assert.ok(out.includes('[-quick-]'));
  assert.ok(out.includes('{+slow+}'));
});

test('app POST /api/diff returns stats, unified and inline', async () => {
  const res = mockRes();
  await handleRequest({
    method: 'POST',
    url: 'http://localhost/api/diff',
    headers: { host: 'localhost', 'content-type': 'application/json' },
    on() {},
  }, res);
  // simulate body by re-calling with data events
  const req = {
    method: 'POST',
    url: 'http://localhost/api/diff',
    headers: { host: 'localhost' },
    listeners: {},
    on(ev, cb) { this.listeners[ev] = cb; },
    destroy() {},
  };
  const res2 = mockRes();
  handleRequest(req, res2);
  req.listeners.data('{"a":"a\\nb\\nc","b":"a\\nX\\nc"}');
  req.listeners.end();
  await new Promise((r) => setTimeout(r, 20));
  const body = JSON.parse(res2.body);
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.stats.added, 1);
  assert.strictEqual(body.stats.removed, 1);
  assert.ok(body.unified.includes('+X'));
  assert.ok(body.inline.includes('[-b-]'));
  assert.ok(res2.body.length > 0);
});

test('app POST /api/diff rejects invalid JSON with 400', async () => {
  const req = {
    method: 'POST',
    url: 'http://localhost/api/diff',
    headers: { host: 'localhost' },
    listeners: {},
    on(ev, cb) { this.listeners[ev] = cb; },
    destroy() {},
  };
  const res = mockRes();
  handleRequest(req, res);
  req.listeners.data('{oops');
  req.listeners.end();
  await new Promise((r) => setTimeout(r, 10));
  assert.strictEqual(res.status, 400);
  assert.strictEqual(JSON.parse(res.body).ok, false);
});

test('app GET / serves the UI, GET /diff.js serves the module, 404 otherwise', () => {
  const ui = mockRes();
  handleRequest({ method: 'GET', url: 'http://localhost/', headers: { host: 'localhost' } }, ui);
  assert.strictEqual(ui.status, 200);
  assert.ok(ui.body.includes('Diff Tool'));

  const mod = mockRes();
  handleRequest({ method: 'GET', url: 'http://localhost/diff.js', headers: { host: 'localhost' } }, mod);
  assert.strictEqual(mod.status, 200);
  assert.ok(mod.body.includes('DiffTool'));

  const miss = mockRes();
  handleRequest({ method: 'GET', url: 'http://localhost/nope', headers: { host: 'localhost' } }, miss);
  assert.strictEqual(miss.status, 404);
});

test('app GET /health is ok', () => {
  const res = mockRes();
  handleRequest({ method: 'GET', url: 'http://localhost/health', headers: { host: 'localhost' } }, res);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(JSON.parse(res.body).ok, true);
});
'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    root.DiffTool = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const MAX_CELLS = 4e6;

  function tokenizeLines(text) {
    return String(text == null ? '' : text).split('\n');
  }

  function tokenizeWords(text) {
    return String(text == null ? '' : text).match(/\s+|[^\s]+/g) || [];
  }

  function tokenize(text, mode) {
    if (mode === 'words') return tokenizeWords(text);
    if (mode === 'chars') return String(text == null ? '' : text).split('');
    return tokenizeLines(text);
  }

  function lcsLength(a, b) {
    const m = a.length;
    const n = b.length;
    if (m === 0 || n === 0) return 0;
    const table = [];
    for (let i = 0; i <= m; i++) table.push(new Uint32Array(n + 1));
    for (let i = m - 1; i >= 0; i--) {
      for (let j = n - 1; j >= 0; j--) {
        table[i][j] = a[i] === b[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
      }
    }
    return table[0][0];
  }

  function lcsSequence(a, b) {
    const m = a.length;
    const n = b.length;
    const out = [];
    let i = 0;
    let j = 0;
    while (i < m && j < n) {
      if (a[i] === b[j]) {
        out.push(a[i]);
        i++;
        j++;
      } else if (lcsLength(a.slice(i + 1), b.slice(j)) >= lcsLength(a.slice(i), b.slice(j + 1))) {
        i++;
      } else {
        j++;
      }
    }
    return out;
  }

  // Ops: { type: 'equal' | 'insert' | 'delete', value, aIndex, bIndex }
  // Classic DP LCS + backtracking. Guarded by MAX_CELLS so huge inputs
  // fall back to a coarse but still-valid replace-all diff.
  function diffTokens(a, b) {
    const m = a.length;
    const n = b.length;
    if (m === 0 && n === 0) return [];
    if (m === 0) {
      return b.map((v, j) => ({ type: 'insert', value: v, aIndex: 0, bIndex: j }));
    }
    if (n === 0) {
      return a.map((v, i) => ({ type: 'delete', value: v, aIndex: i, bIndex: 0 }));
    }
    if (isTooLarge(m, n)) {
      return [
        ...a.map((v, i) => ({ type: 'delete', value: v, aIndex: i, bIndex: 0 })),
        ...b.map((v, j) => ({ type: 'insert', value: v, aIndex: 0, bIndex: j })),
      ];
    }

    // table[i][j] = LCS length of a[i..] and b[j..]
    const table = [];
    for (let i = 0; i <= m; i++) table.push(new Uint32Array(n + 1));
    for (let i = m - 1; i >= 0; i--) {
      for (let j = n - 1; j >= 0; j--) {
        table[i][j] = a[i] === b[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
      }
    }

    const ops = [];
    let i = 0;
    let j = 0;
    while (i < m && j < n) {
      if (a[i] === b[j]) {
        ops.push({ type: 'equal', value: a[i], aIndex: i, bIndex: j });
        i++;
        j++;
      } else if (table[i + 1][j] >= table[i][j + 1]) {
        ops.push({ type: 'delete', value: a[i], aIndex: i, bIndex: j });
        i++;
      } else {
        ops.push({ type: 'insert', value: b[j], aIndex: i, bIndex: j });
        j++;
      }
    }
    while (i < m) {
      ops.push({ type: 'delete', value: a[i], aIndex: i, bIndex: j });
      i++;
    }
    while (j < n) {
      ops.push({ type: 'insert', value: b[j], aIndex: i, bIndex: j });
      j++;
    }
    return ops;
  }

  // Fast path: strip common prefix/suffix, LCS only the differing middle.
  function diffLines(aLines, bLines) {
    let start = 0;
    while (start < aLines.length && start < bLines.length && aLines[start] === bLines[start]) {
      start++;
    }
    let endA = aLines.length;
    let endB = bLines.length;
    while (endA > start && endB > start && aLines[endA - 1] === bLines[endB - 1]) {
      endA--;
      endB--;
    }
    const midA = aLines.slice(start, endA);
    const midB = bLines.slice(start, endB);
    const head = aLines.slice(0, start).map((v, k) => ({ type: 'equal', value: v, aIndex: k, bIndex: k }));
    const tail = aLines.slice(endA).map((v, k) => ({
      type: 'equal',
      value: v,
      aIndex: endA + k,
      bIndex: endB + k,
    }));
    // shift the middle-diff indices back to absolute positions
    const mid = diffTokens(midA, midB).map((op) => ({
      ...op,
      aIndex: op.aIndex + start,
      bIndex: op.bIndex + start,
    }));
    return head.concat(mid, tail);
  }

  function isTooLarge(m, n) {
    return m * n > MAX_CELLS;
  }

  function computeDiff(oldText, newText, opts) {
    const options = opts || {};
    const mode = options.mode || 'lines';
    const ignoreCase = !!options.ignoreCase;
    const ignoreWhitespace = !!options.ignoreWhitespace;

    const norm = (s) => {
      let v = String(s == null ? '' : s);
      if (ignoreWhitespace) v = v.replace(/\s+/g, ' ').trim();
      if (ignoreCase) v = v.toLowerCase();
      return v;
    };

    const a = tokenize(oldText, mode);
    const b = tokenize(newText, mode);
    const aN = a.map(norm);
    const bN = b.map(norm);

    const ops = mode === 'lines' && isTooLarge(a.length, b.length)
      ? [
          ...a.map((v, i) => ({ type: 'delete', value: a[i], aIndex: i, bIndex: 0 })),
          ...b.map((v, i) => ({ type: 'insert', value: b[i], aIndex: 0, bIndex: i })),
        ]
      : mode === 'lines'
        ? diffLines(aN, bN).map((op) => ({
            ...op,
            value: op.type === 'insert' ? b[op.bIndex] : a[op.aIndex],
          }))
        : diffTokens(aN, bN).map((op) => ({
            ...op,
            value: op.type === 'insert' ? b[op.bIndex] : a[op.aIndex],
          }));

    return summarize(ops, a, b);
  }

  function summarize(ops, a, b) {
    let added = 0;
    let removed = 0;
    let unchanged = 0;
    for (const op of ops) {
      if (op.type === 'insert') added++;
      else if (op.type === 'delete') removed++;
      else unchanged++;
    }
    const similar = a.length + b.length === 0
      ? 100
      : Math.round((2 * unchanged) / (a.length + b.length) * 100);
    return {
      ops,
      stats: { added, removed, unchanged, similar },
      aLength: a.length,
      bLength: b.length,
    };
  }

  function hunkGroups(ops, context) {
    const ctx = context == null ? 3 : context;
    const changed = [];
    ops.forEach((op, i) => {
      if (op.type !== 'equal') changed.push(i);
    });
    if (changed.length === 0) return [];
    const groups = [];
    let cur = null;
    for (const idx of changed) {
      const start = Math.max(0, idx - ctx);
      const end = Math.min(ops.length - 1, idx + ctx);
      if (!cur || start > cur.end + 1) {
        cur = { start, end, changes: [] };
        groups.push(cur);
      }
      cur.end = Math.max(cur.end, end);
      cur.changes.push(idx);
    }
    return groups;
  }

  function formatUnified(ops, context, labels) {
    const ctx = context == null ? 3 : context;
    const nameA = (labels && labels.a) || 'a';
    const nameB = (labels && labels.b) || 'b';
    const out = [`--- ${nameA}`, `+++ ${nameB}`];
    for (const g of hunkGroups(ops, ctx)) {
      const slice = ops.slice(g.start, g.end + 1);
      const aStart = slice.find((o) => o.aIndex !== undefined && o.type !== 'insert');
      const bStart = slice.find((o) => o.bIndex !== undefined && o.type !== 'delete');
      const aCount = slice.filter((o) => o.type !== 'insert').length;
      const bCount = slice.filter((o) => o.type !== 'delete').length;
      const aLine = (aStart ? aStart.aIndex : 0) + 1;
      const bLine = (bStart ? bStart.bIndex : 0) + 1;
      out.push(`@@ -${aLine},${aCount} +${bLine},${bCount} @@`);
      for (const op of slice) {
        const prefix = op.type === 'insert' ? '+' : op.type === 'delete' ? '-' : ' ';
        out.push(prefix + op.value);
      }
    }
    return out.join('\n') + '\n';
  }

  function formatInline(aText, bText) {
    const ops = computeDiff(aText, bText, { mode: 'words' });
    let out = '';
    for (const op of ops.ops) {
      if (op.type === 'equal') out += op.value;
      else if (op.type === 'insert') out += '{+' + op.value + '+}';
      else out += '[-' + op.value + '-]';
    }
    return out;
  }

  return {
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
  };
});
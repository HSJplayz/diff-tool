# Diff Tool

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-18%2B-339933.svg)]()
[![CI](https://github.com/HSJplayz/diff-tool/actions/workflows/ci.yml/badge.svg)](https://github.com/HSJplayz/diff-tool/actions)
[![Streak Day 14](https://img.shields.io/badge/Streak-Day%2014-green.svg)](https://github.com/HSJplayz/streak)

> A zero-dependency text diff engine (longest common subsequence) with a terminal CLI and a live side-by-side web comparator. Unified-diff output, word-level highlighting, change stats.

Built with plain Node.js (no frameworks, no npm packages) on **Day 14** of the daily projects streak.

## Why

`git diff` is great for code, but comparing two arbitrary texts (a config, a log, a draft) usually means eyeballing or a heavyweight online tool that uploads your data. This runs entirely locally, understands words and characters as well as lines, and shows how similar two texts are.

## Features

- **Real LCS diff** — dynamic-programming longest common subsequence with backtracking, plus a fast path that strips the common prefix/suffix before running the expensive part.
- **Three granularities** — line (default), word, or character.
- **Unified-diff output** — proper `---`/`+++` headers, `@@ -a,b +c,d @@` hunk ranges, and configurable context lines.
- **Inline word diff** — `[-removed-]{+added+}` markers for pinpoint changes.
- **Change statistics** — added / removed / unchanged counts and a similarity percentage.
- **Ignore flags** — case-insensitive and whitespace-insensitive comparison.
- **Two front ends, one core** — `diff.js` is a UMD module shared by the CLI and the browser.
- **Zero dependencies** — built-in `node:` modules; web UI has no CDN.

## Quick start

### Terminal

```bash
node cli.js old.txt new.txt                 # unified diff
node cli.js old.txt new.txt --stats         # counts + similarity
node cli.js old.txt new.txt --inline        # word-level inline diff
node cli.js old.txt new.txt -m words        # word granularity
node cli.js old.txt new.txt -i -w           # ignore case + whitespace
node cli.js old.txt new.txt -C 5            # 5 lines of context

# pipe one side from stdin
cat new.txt | node cli.js old.txt -

# exit code: 0 = identical, 1 = different (like real diff)
```

### Web UI

```bash
node server.js --port 3000
# open http://127.0.0.1:3000
```

Two panes, live diffing as you type, with stats and colorized unified output. A JSON API backs it:

| Endpoint | Description |
| --- | --- |
| `POST /api/diff` | Body `{a, b, mode, context, ignoreCase, ignoreWhitespace}` -> stats, ops, unified output, inline diff |
| `GET /health` | Liveness check |

## Tests

```bash
node --test test_diff.js
```

19 tests cover tokenization, LCS length/sequence, op reconstruction (diff ops always rebuild both inputs), minimality, ignore flags, hunk grouping, unified formatting, inline formatting, and the HTTP API.

## Structure

```
diff.js          shared UMD core: LCS, diffTokens, diffLines, hunks, unified/inline formatting
cli.js           terminal front end (unified/stats/inline modes)
app.js           HTTP handler + POST /api/diff
server.js        entry point (--port/--host)
public/index.html two-pane live-diff web UI (no CDN)
test_diff.js     test suite (node:test)
```

## Future scope

- **Directory diff** — walk two folders and diff matching filenames (`diff -r` style).
- **Syntax-aware mode** — tokenize code so a changed string doesn't reflow a whole block.
- **Patch apply** — feed the unified output back to apply changes to a file.
- **Fuzzy whitespace/rename tolerance** for noisy real-world files.
- **Side-by-side split view** in the web UI next to the unified view.

## License

MIT.
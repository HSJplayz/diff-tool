# Changelog

All notable changes to this project are documented here.

## [1.0.0] - 2026-10-02

### Added
- Diff engine (`diff.js`, UMD shared by Node + browser): DP longest-common-subsequence with backtracking, common-prefix/suffix fast path with an O(m*n) cell guard, line/word/char tokenizers, hunk grouping with configurable context, unified-format rendering (`---`/`+++`, `@@` ranges), inline `[-old-]{+new+}` rendering, change stats with similarity percentage, ignore-case and ignore-whitespace comparison.
- Terminal front end (`cli.js`): unified output, `--stats`, `--inline`, `--mode`, `--context`, `--ignore-case`, `--ignore-whitespace`, stdin piping, standard `diff`-style exit codes.
- HTTP layer (`app.js` + `server.js`): two-pane web UI on `/`, `POST /api/diff` (stats + ops + unified + inline), `GET /health`, `--port`/`--host`, graceful shutdown.
- Live-diff web UI (`public/index.html`): side-by-side editors, live compare on input, colorized unified output, stats tiles, swap, no CDN.
- Test suite (`test_diff.js`): 19 `node:test` cases — tokenization, LCS correctness, op reconstruction, minimality, ignore flags, hunk grouping, unified/inline formatting, and HTTP API (valid + invalid JSON, health, static routes).
- GitHub Actions CI (Node 18 & 22), README, MIT license, `.gitignore`.
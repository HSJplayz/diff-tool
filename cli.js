'use strict';

const fs = require('fs');
const { computeDiff, formatUnified, formatInline, tokenize } = require('./diff.js');

function parseArgs(argv) {
  const args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--mode' || a === '-m') args.flags.mode = argv[++i];
    else if (a === '--context' || a === '-C') args.flags.context = parseInt(argv[++i], 10);
    else if (a === '--ignore-case' || a === '-i') args.flags.ignoreCase = true;
    else if (a === '--ignore-whitespace' || a === '-w') args.flags.ignoreWhitespace = true;
    else if (a === '--inline') args.flags.inline = true;
    else if (a === '--stats' || a === '-s') args.flags.stats = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else args._.push(a);
  }
  return args;
}

function readInput(pathOrDash) {
  if (pathOrDash === '-' || pathOrDash === undefined) {
    return fs.readFileSync(0, 'utf8');
  }
  return fs.readFileSync(pathOrDash, 'utf8');
}

function printHelp() {
  console.log('Usage: node cli.js <old-file> <new-file> [options]');
  console.log('       node cli.js <old-file> - [options]   (new text from stdin)');
  console.log('       node cli.js - - [options]           (both from stdin)');
  console.log('');
  console.log('Options:');
  console.log('  -m, --mode <lines|words|chars>  diff granularity (default lines)');
  console.log('  -C, --context <n>               unified-diff context lines (default 3)');
  console.log('  -i, --ignore-case               ignore case differences');
  console.log('  -w, --ignore-whitespace         ignore whitespace-only changes');
  console.log('      --inline                    inline word-level diff');
  console.log('  -s, --stats                     show change statistics');
  console.log('  -h, --help                      show this help');
}

function run() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (args._.length < 2) {
    printHelp();
    process.exitCode = 1;
    return;
  }

  const [oldPath, newPath] = args._;
  let oldText;
  let newText;
  try {
    oldText = readInput(oldPath);
    newText = readInput(newPath);
  } catch (err) {
    console.error(`Error reading input: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  const mode = args.flags.mode || 'lines';
  const opts = {
    mode,
    ignoreCase: args.flags.ignoreCase,
    ignoreWhitespace: args.flags.ignoreWhitespace,
  };

  if (args.flags.inline) {
    process.stdout.write(formatInline(oldText, newText) + '\n');
    return;
  }

  const result = computeDiff(oldText, newText, opts);

  if (args.flags.stats) {
    const s = result.stats;
    console.log(`mode: ${mode}`);
    console.log(`similarity: ${s.similar}%`);
    console.log(`added: ${s.added}`);
    console.log(`removed: ${s.removed}`);
    console.log(`unchanged: ${s.unchanged}`);
    return;
  }

  const context = args.flags.context;
  const labels = { a: oldPath === '-' ? 'stdin(old)' : oldPath, b: newPath === '-' ? 'stdin(new)' : newPath };
  const unified = formatUnified(result.ops, context, labels);
  process.stdout.write(unified);
  // diff exit code convention: 0 = same, 1 = differ
  process.exitCode = result.stats.added === 0 && result.stats.removed === 0 ? 0 : 1;
}

run();
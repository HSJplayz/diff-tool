'use strict';

const http = require('http');
const { handleRequest } = require('./app.js');

function parseArgs(argv) {
  const args = { port: 3000, host: '127.0.0.1' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--port') args.port = parseInt(argv[++i], 10);
    else if (argv[i] === '--host') args.host = argv[++i];
    else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log('Usage: node server.js [--port PORT] [--host HOST]');
      console.log('Serves the Diff Tool web UI on / and a JSON diff API at POST /api/diff.');
      process.exit(0);
    }
  }
  return args;
}

function main() {
  const { port, host } = parseArgs(process.argv.slice(2));
  const server = http.createServer((req, res) => handleRequest(req, res));
  server.listen(port, host, () => {
    console.log(`Diff Tool listening on http://${host}:${port}`);
  });
  const shutdown = (signal) => {
    console.log(`\n${signal} received, shutting down...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 3000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

if (require.main === module) main();

module.exports = { parseArgs, main };
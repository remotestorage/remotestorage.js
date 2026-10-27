const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.join(__dirname, 'public');
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/remotestorage-solid.js', ['remotestorage-solid.js', 'text/javascript; charset=utf-8']],
  ['/remotestorage-solid.js.map', ['remotestorage-solid.js.map', 'application/json']],
  ['/remotestorage-solid.js.LICENSE.txt', ['remotestorage-solid.js.LICENSE.txt', 'text/plain; charset=utf-8']]
]);
const server = http.createServer((request, response) => {
  const entry = files.get(new URL(request.url, 'http://localhost').pathname);
  if (!entry) { response.writeHead(404).end(); return; }
  const bundleRoot = process.env.SOLID_BUNDLE_DIRECTORY || path.resolve(__dirname, '../../release');
  const filename = entry[0].startsWith('remotestorage-solid.js')
    ? path.join(bundleRoot, entry[0]) : path.join(root, entry[0]);
  fs.readFile(filename, (error, bytes) => {
    if (error) { response.writeHead(500).end('Demo asset missing. Build the Solid bundle at the repository root first.'); return; }
    response.writeHead(200, { 'Content-Type': entry[1], 'Cache-Control': 'no-store' });
    response.end(bytes);
  });
});
function startApp() {
  server.listen(8787, '127.0.0.1', () => {
    console.log('Solid demo ready: open http://localhost:8787 in your browser.');
    console.log('Local pod server: http://localhost:3000 (in-memory, resets when stopped).');
  });
}
const args = [path.join(__dirname, 'node_modules/@solid/community-server/bin/server.js'),
  '--port', '3000', '--baseUrl', 'http://localhost:3000/', '--loggingLevel', 'error'];
const seedIndex = process.argv.indexOf('--seed-file');
if (seedIndex !== -1) { args.push('--seedConfig', process.argv[seedIndex + 1]); }
const pod = spawn(process.execPath, args, { cwd: __dirname, stdio: 'inherit' });
let stopping = false;
function stop() {
  if (stopping) { return; }
  stopping = true;
  pod.kill('SIGTERM');
  server.close(() => process.exit(0));
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
pod.on('exit', code => { if (!stopping) { console.error('Pod server exited:', code); stop(); } });
function waitForPod() {
  if (stopping) { return; }
  const request = http.get('http://localhost:3000/.well-known/openid-configuration', response => {
    response.resume();
    if (response.statusCode === 200) { startApp(); }
    else { setTimeout(waitForPod, 250); }
  });
  request.setTimeout(1000, () => request.destroy());
  request.on('error', () => { if (!stopping) { setTimeout(waitForPod, 250); } });
}
waitForPod();

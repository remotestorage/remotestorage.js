const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawn } = require('node:child_process');

const directory = mkdtempSync(join(tmpdir(), 'rs-solid-test-'));
const seed = join(directory, 'accounts.json');
writeFileSync(seed, JSON.stringify([{
  email: 'solid-test@example.test', password: process.env.RS_SOLID_TEST_PASSWORD,
  pods: [{ name: 'sync-test', settings: { linkStorage: true } }]
}]), { mode: 0o600 });
const server = spawn(process.execPath, ['server.cjs', '--seed-file', seed], { stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.kill(signal));
}
server.on('exit', code => {
  rmSync(directory, { recursive: true, force: true });
  process.exit(code || 0);
});

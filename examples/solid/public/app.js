/* global RemoteStorage */
'use strict';
const $ = id => document.getElementById(id);
const passed = new Set();
let busy = false;
const remote = new RemoteStorage();
remote.access.claim('solid-demo', 'rw');
remote.caching.enable('/solid-demo/');
const client = remote.scope('/solid-demo/');
client.declareType('note', { type: 'object' });
window.demo = { remote, client, passed };

function log(message, kind = '') {
  const row = document.createElement('li');
  row.className = kind;
  const time = document.createElement('time');
  time.textContent = new Date().toLocaleTimeString();
  row.append(time, document.createTextNode(message));
  $('activity').prepend(row);
  while ($('activity').children.length > 50) { $('activity').lastChild.remove(); }
}
function result(value) { $('result').textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2); }
function controls() {
  for (const button of document.querySelectorAll('.operation')) { button.disabled = busy || !remote.connected; }
  $('connect').disabled = busy || remote.connected;
  $('disconnect').disabled = busy || !remote.connected;
}
function pass(name) {
  passed.add(name);
  $('summary').textContent = passed.size + ' checks passed';
  log(name + ': PASS', 'pass');
}
function limit(promise) {
  let timer;
  return Promise.race([promise, new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error('Operation timed out; inspect the activity log.')), 20000);
  })]).finally(() => clearTimeout(timer));
}
async function operation(action) {
  busy = true; controls();
  try { await limit(action()); }
  catch (error) { log(error.message || String(error), 'error'); result('Failed: ' + (error.message || error)); }
  finally { busy = false; controls(); }
}
function expectStatus(response, allowed) {
  if (!allowed.includes(response.statusCode)) { throw new Error('Unexpected HTTP status ' + response.statusCode); }
  return response;
}
async function sync() {
  await remote.startSync();
}
async function waitForPod(path, status, matches = () => true) {
  // startSync() schedules work; its promise does not wait for all queued
  // transfers. Verify the remote state rather than racing those requests.
  for (let attempt = 0; attempt < 100; attempt++) {
    const response = await remote.solid.get(path);
    if (response.statusCode === status && matches(response)) { return response; }
    if (![200, 404].includes(response.statusCode)) { expectStatus(response, [status]); }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('The expected change has not reached the pod after ten seconds.');
}
async function hash(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');
}

remote.on('error', error => log(error.message || String(error), 'error'));
remote.on('pod-not-selected', () => {
  const pods = remote.solid.getPodURLs() || [];
  if (pods.length === 0) { log('This account advertises no pods.', 'error'); return; }
  if (pods.length === 1) { remote.solid.setPodURL(pods[0]); return; }
  $('pods').replaceChildren(...pods.map(pod => {
    const option = document.createElement('option'); option.value = pod; option.textContent = pod; return option;
  }));
  $('pod-choice').hidden = false;
});
remote.on('connected', () => {
  $('status').textContent = 'Connected';
  $('status').parentElement.classList.add('connected');
  $('identity').textContent = remote.remote.userAddress + ' · ' + remote.solid.getPodURL();
  $('pod-choice').hidden = true;
  pass('Login + pod selection'); controls();
});
remote.on('disconnected', () => {
  $('status').textContent = 'Not connected';
  $('status').parentElement.classList.remove('connected');
  $('identity').textContent = 'Session ended; local cache cleared.';
  log('Disconnected.'); controls();
});
remote.on('sync-done', outcome => {
  if (outcome.completed) { log('Synchronization complete.'); }
});
remote.on('network-offline', () => log('Pod network request failed.', 'error'));
client.on('change', change => log('Change: ' + change.origin + ' · ' + change.relativePath));

$('connect-form').addEventListener('submit', event => {
  event.preventDefault();
  localStorage.setItem('solid-demo:issuer', $('issuer').value);
  operation(async () => {
    remote.solid.setAuthURL($('issuer').value);
    $('status').textContent = 'Signing in…';
    log('Starting Solid-OIDC login.');
    await remote.solid.connect();
  });
});
$('issuer').value = localStorage.getItem('solid-demo:issuer') || $('issuer').value;
$('choose-pod').addEventListener('click', () => operation(async () => remote.solid.setPodURL($('pods').value)));
$('disconnect').addEventListener('click', () => remote.disconnect());

$('save-json').addEventListener('click', () => operation(async () => {
  // Load an existing sample before editing so a new browser has its common
  // revision. Otherwise creating the fixed demo filename can conflict.
  await client.getObject('note.json', 0);
  const expected = { message: $('note').value, savedAt: new Date().toISOString() };
  await client.storeObject('note', 'note.json', expected);
  await sync();
  const response = await waitForPod('/solid-demo/note.json', 200, response => JSON.parse(response.body).savedAt === expected.savedAt);
  const actual = JSON.parse(response.body);
  if (actual.message !== expected.message) { throw new Error('Remote JSON did not match the saved note.'); }
  result({ check: 'JSON saved and verified on the pod', status: response.statusCode, revision: response.revision, data: actual });
  pass('JSON save + remote read');
}));
$('read-json').addEventListener('click', () => operation(async () => {
  const response = expectStatus(await remote.solid.get('/solid-demo/note.json'), [200]);
  result({ status: response.statusCode, revision: response.revision, data: JSON.parse(response.body) });
  pass('Remote JSON read');
}));
$('test-binary').addEventListener('click', () => operation(async () => {
  await client.getFile('bytes.bin', 0);
  const original = Uint8Array.from({ length: 1024 }, (_, i) => i % 256);
  await client.storeFile('application/octet-stream', 'bytes.bin', original);
  await sync();
  const response = await waitForPod('/solid-demo/bytes.bin', 200);
  const expectedHash = await hash(original);
  const actualHash = await hash(response.body);
  if (actualHash !== expectedHash) { throw new Error('The binary bytes changed during the round trip.'); }
  result({ check: '1,024 bytes round-tripped without changes', revision: response.revision, sha256: actualHash });
  pass('Binary integrity');
}));
$('test-conflict').addEventListener('click', () => operation(async () => {
  const path = '/solid-demo/conflict.txt';
  expectStatus(await remote.solid.put(path, 'first version', 'text/plain'), [200, 201, 204]);
  const old = expectStatus(await remote.solid.get(path), [200]);
  expectStatus(await remote.solid.put(path, 'newer version', 'text/plain', { ifMatch: old.revision }), [200, 201, 204]);
  const stalePut = await remote.solid.put(path, 'stale version', 'text/plain', { ifMatch: old.revision });
  const staleDelete = await remote.solid.delete(path, { ifMatch: old.revision });
  expectStatus(stalePut, [412]); expectStatus(staleDelete, [412]);
  const current = expectStatus(await remote.solid.get(path), [200]);
  if (current.body !== 'newer version') { throw new Error('The newer value was lost.'); }
  result({ check: 'Newer value protected', staleWrite: stalePut.statusCode, staleDelete: staleDelete.statusCode, currentValue: current.body });
  pass('Stale write + delete protection');
}));
$('list').addEventListener('click', () => operation(async () => {
  const response = expectStatus(await remote.solid.get('/solid-demo/'), [200]);
  result({ check: 'Real pod container listing', entries: response.body });
  pass('Turtle listing + ETags');
}));
$('sync').addEventListener('click', () => operation(async () => { await sync(); result('Synchronization requested. The activity log reports completed transfers.'); }));
$('delete-json').addEventListener('click', () => operation(async () => {
  await client.getObject('note.json', 0);
  await client.remove('note.json');
  await sync();
  const response = await waitForPod('/solid-demo/note.json', 404);
  result({ check: 'Sample JSON removed from the pod', status: response.statusCode });
  pass('Delete sample JSON');
}));
log('Experimental bundle loaded. Local cache and sync are enabled.');

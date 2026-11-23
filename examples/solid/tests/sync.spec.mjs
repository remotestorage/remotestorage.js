import { test, expect } from '@playwright/test';

const APP = 'http://localhost:8787/';

async function login(page) {
  await page.goto(APP);
  await page.locator('#connect').click();
  await page.locator('input[type=email]').fill('solid-test@example.test');
  await page.locator('input[type=password]').fill(process.env.RS_SOLID_TEST_PASSWORD);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.getByRole('button', { name: 'Authorize', exact: true }).click();
  await expect(page.locator('#status')).toHaveText('Connected');
  await page.evaluate(() => {
    window.demo.remote.setSyncInterval(600000);
    window.demo.remote.setBackgroundSyncInterval(600000);
  });
}

async function write(page, path, text) {
  await page.evaluate(async ({ path, text }) => {
    await window.demo.client.storeObject('note', path, { text });
  }, { path, text });
  await expect.poll(() => page.evaluate(async path => {
    const result = await window.demo.remote.solid.get('/solid-demo/' + path);
    return result.statusCode === 200 ? JSON.parse(result.body).text : null;
  }, path)).toBe(text);
}

async function cached(page, path) {
  return page.evaluate(async path => {
    const node = (await window.demo.remote.local.getNodes(['/solid-demo/' + path]))['/solid-demo/' + path];
    const body = node?.common?.body;
    return typeof body === 'string' ? JSON.parse(body).text : null;
  }, path);
}

test('two authenticated browser clients: polling suppression, notifications, renewal, recovery and conflicts', async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const a = await contextA.newPage();
  const b = await contextB.newPage();
  const messages = [];
  const errors = [];
  for (const page of [a, b]) { page.on('pageerror', error => errors.push(error.message)); }
  b.on('websocket', socket => socket.on('framereceived', frame => {
    try { messages.push(JSON.parse(String(frame.payload))); } catch { /* Ignore non-JSON protocol frames. */ }
  }));
  try {
    await login(a);
    await login(b);
    await write(a, 'nested/note.json', 'initial');
    await b.evaluate(() => window.demo.client.getObject('nested/note.json', 0));
    await expect.poll(() => cached(b, 'nested/note.json')).toBe('initial');
    await expect.poll(() => b.evaluate(() => {
      const watches = window.demo.remote.solid.notifications?.watches;
      return watches?.get('/solid-demo/nested/note.json')?.socket?.readyState;
    })).toBe(1);

    // Make this file stale and observe multiple real polling cycles. An active
    // subscription must suppress its GETs, without suppressing the cycles.
    await expect.poll(() => b.evaluate(() => {
      const rs = window.demo.remote;
      return rs.solid.hasActiveSubscription('/solid-demo/nested/note.json') && !rs.sync.hasTasks();
    })).toBe(true);
    let fileReads = 0;
    b.on('request', request => {
      if (request.method() === 'GET' && new URL(request.url()).pathname.endsWith('/solid-demo/nested/note.json')) { fileReads++; }
    });
    await b.evaluate(async () => {
      const rs = window.demo.remote;
      const path = '/solid-demo/nested/note.json';
      const nodes = await rs.local.getNodes([path]);
      nodes[path].common.timestamp = 0;
      await rs.local.setNodes(nodes);
      window.routineChecks = 0;
      const collect = rs.sync.collectRefreshTasks.bind(rs.sync);
      rs.sync.collectRefreshTasks = async () => { await collect(); window.routineChecks++; };
      rs.setSyncInterval(2000);
      rs.setBackgroundSyncInterval(2000);
      await rs.startSync();
    });
    await expect.poll(() => b.evaluate(() => window.routineChecks)).toBeGreaterThanOrEqual(3);
    expect(fileReads).toBe(0);
    await b.evaluate(() => {
      window.demo.remote.setSyncInterval(600000);
      window.demo.remote.setBackgroundSyncInterval(600000);
    });

    const before = messages.length;
    await write(a, 'nested/note.json', 'live edit');
    await expect.poll(() => cached(b, 'nested/note.json')).toBe('live edit');
    expect(messages.slice(before).some(message => message.object?.endsWith('/nested/note.json'))).toBe(true);

    // Establish an ALL-cached container, then discover a new child through Add.
    await b.evaluate(() => window.demo.client.getListing('nested/', 0));
    await expect.poll(() => b.evaluate(() =>
      window.demo.remote.solid.notifications?.watches.get('/solid-demo/nested/')?.socket?.readyState)).toBe(1);
    await write(a, 'nested/added.json', 'new child');
    await expect.poll(() => cached(b, 'nested/added.json')).toBe('new child');
    await a.evaluate(() => window.demo.client.remove('nested/added.json'));
    await expect.poll(() => cached(b, 'nested/added.json')).toBe(null);

    // Drop a notification, then force the real renewal path without waiting
    // thirty minutes. Opening the replacement channel must recover the edit.
    await b.evaluate(() => {
      const watch = window.demo.remote.solid.notifications.watches.get('/solid-demo/nested/note.json');
      watch.socket.onmessage = null;
      window.previousSocket = watch.socket;
    });
    await write(a, 'nested/note.json', 'recovered on renewal');
    expect(await cached(b, 'nested/note.json')).toBe('live edit');
    await b.evaluate(async () => {
      const notifications = window.demo.remote.solid.notifications;
      notifications.watches.get('/solid-demo/nested/note.json').renewAt = Date.now() - 1;
      await notifications.reconcile();
    });
    await expect.poll(() => cached(b, 'nested/note.json')).toBe('recovered on renewal');
    expect(await b.evaluate(() => {
      const solid = window.demo.remote.solid;
      return solid.hasActiveSubscription('/solid-demo/nested/note.json') &&
        solid.notifications.watches.get('/solid-demo/nested/note.json').socket !== window.previousSocket;
    })).toBe(true);

    // Explicitly close sockets too: browser network emulation alone may leave
    // pre-existing WebSockets alive, which would not exercise a delivery gap.
    await contextB.setOffline(true);
    await b.evaluate(() => {
      for (const watch of window.demo.remote.solid.notifications.watches.values()) { watch.socket?.close(); }
    });
    await write(a, 'nested/note.json', 'changed while offline');
    await write(a, 'nested/offline.json', 'created while offline');
    expect(await cached(b, 'nested/note.json')).toBe('recovered on renewal');
    await contextB.setOffline(false);
    await expect.poll(() => cached(b, 'nested/note.json')).toBe('changed while offline');
    await expect.poll(() => cached(b, 'nested/offline.json')).toBe('created while offline');

    // Reopening the app restores authentication and reconciles its persisted cache.
    await b.goto('about:blank');
    await write(a, 'nested/note.json', 'changed while app closed');
    await b.goto(APP);
    await expect(b.locator('#status')).toHaveText('Connected');
    await expect.poll(() => cached(b, 'nested/note.json')).toBe('changed while app closed');

    // Providers without usable notifications still recover through polling.
    await contextB.route('**/.notifications/**', route => route.fulfill({ status: 503, body: 'Notifications unavailable' }));
    await b.reload();
    await expect(b.locator('#status')).toHaveText('Connected');
    await b.evaluate(() => {
      window.demo.remote.setSyncInterval(2000);
      window.demo.remote.setBackgroundSyncInterval(2000);
    });
    await write(a, 'nested/note.json', 'polling fallback');
    // Exercise the actual default one-minute recovery floor, not an artificial
    // two-second per-resource poll. Other operations above still use live events.
    await expect.poll(() => cached(b, 'nested/note.json'), { timeout: 75000 }).toBe('polling fallback');

    const stale = await b.evaluate(() => window.demo.remote.solid.get('/solid-demo/nested/note.json'));
    await write(a, 'nested/note.json', 'protected newer edit');
    const statuses = await b.evaluate(async revision => {
      const solid = window.demo.remote.solid;
      return [
        (await solid.put('/solid-demo/nested/note.json', '{"text":"stale"}', 'application/json', { ifMatch: revision })).statusCode,
        (await solid.delete('/solid-demo/nested/note.json', { ifMatch: revision })).statusCode
      ];
    }, stale.revision);
    expect(statuses).toEqual([412, 412]);
    await expect.poll(() => cached(b, 'nested/note.json'), { timeout: 75000 }).toBe('protected newer edit');
    expect(errors).toEqual([]);
    await a.evaluate(() => window.demo.remote.disconnect());
    await expect(a.locator('#status')).toHaveText('Not connected');
  } finally {
    await contextA.close();
    await contextB.close();
  }
});

import { getSolidDataset, getThingAll, getUrlAll } from '@inrupt/solid-client';
import type RemoteStorage from './remotestorage';
import type { Solid } from './solid';
import config from './config';
import log from './log';

const NOTIFY = 'http://www.w3.org/ns/solid/notifications#';
const CHANNEL_TYPE = NOTIFY + 'WebSocketChannel2023';
const STORAGE_DESCRIPTION = 'http://www.w3.org/ns/solid/terms#storageDescription';
const MAX_CHANNELS = 8;
const RECOVERY_INTERVAL = 60000;
const RECOVERY_BATCH = 2;
const RENEW_AFTER = 30 * 60 * 1000;

interface Watch {
  path: string;
  socket?: WebSocket;
  channel?: string;
  pending?: boolean;
  opened?: boolean;
  retryAt: number;
  failures: number;
  renewAt?: number;
}

/** Validate discovered endpoints without restricting legitimate separate notification hosts. */
function endpoint (value: string, websocket = false): string {
  const url = new URL(value);
  const secure = websocket ? 'wss:' : 'https:';
  const insecure = websocket ? 'ws:' : 'http:';
  if (url.username || url.password || url.hash || (url.protocol !== secure &&
      !(url.protocol === insecure && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) {
    throw new Error('Invalid Solid notification endpoint.');
  }
  return url.href;
}

/** Resource notifications with reconnect/renewal recovery and polling for unwatched paths. @internal */
export class SolidNotifications {
  private active = false;
  private watches = new Map<string, Watch>();
  private controllers = new Set<AbortController>();
  private service?: string;
  private features: string[] = [];
  private discoveryRetryAt = 0;
  private timer?: ReturnType<typeof setInterval>;
  private scheduled?: ReturnType<typeof setTimeout>;
  private reconciling = false;
  private again = false;
  private recovery = false;
  private lastRecovery = -Infinity;
  private recoveryQueue = new Set<string>();
  private recoveryTimer?: ReturnType<typeof setTimeout>;

  constructor (private rs: RemoteStorage, private solid: Solid) {}

  /** Only suppress routine polling after onopen has queued recovery, until renewal is due. */
  hasActiveSubscription (path: string): boolean {
    const watch = this.watches.get(path);
    return !!(this.active && watch?.opened && watch.socket?.readyState === 1 &&
      watch.renewAt > Date.now());
  }

  private onSync = (): void => { this.schedule(); };
  private onOnline = (): void => { this.schedule(true); };
  private onVisible = (): void => {
    if (document.visibilityState === 'visible') { this.schedule(true); }
  };

  start (): void {
    if (this.active) { return; }
    this.active = true;
    this.rs.on('sync-done', this.onSync);
    window.addEventListener('online', this.onOnline);
    document.addEventListener('visibilitychange', this.onVisible);
    this.timer = setInterval(() => this.schedule(), 10000);
    this.schedule(true);
  }

  private schedule (recover = false): void {
    if (!this.active) { return; }
    this.recovery ||= recover;
    if (this.reconciling) { this.again = true; return; }
    if (this.scheduled) { return; }
    this.scheduled = setTimeout(() => {
      this.scheduled = undefined;
      void this.reconcile();
    }, 100);
  }

  /** Reconcile subscriptions with the current cache, not every resource on the pod. */
  private async reconcile (): Promise<void> {
    if (!this.active || !this.rs.sync || !this.rs.local) { return; }
    this.reconciling = true;
    const recover = this.recovery;
    this.recovery = false;
    try {
      const paths: string[] = [];
      await this.rs.local.forAllNodes(node => {
        if (node && this.rs.access.checkPathPermission(node.path, 'r') &&
            this.rs.caching.checkPath(node.path) !== 'FLUSH') { paths.push(node.path); }
      });
      if (!this.active) { return; }
      if (recover && Date.now() - this.lastRecovery >= RECOVERY_INTERVAL) {
        this.lastRecovery = Date.now();
        const folders = new Set(paths.filter(path => path.endsWith('/')));
        for (const path of paths) {
          const parent = path.slice(0, path.lastIndexOf('/') + 1);
          if (folders.has(path) || !folders.has(parent)) { this.recoveryQueue.add(path); }
        }
        this.drainRecovery();
      }
      if (typeof WebSocket === 'undefined') { return; }
      // Keep existing subscriptions stable; bound sockets and subscription POSTs.
      const wanted = new Set(paths);
      for (const [path, watch] of this.watches) {
        if (!wanted.has(path)) {
          this.watches.delete(path);
          await this.close(watch);
        }
      }
      if (!this.active) { return; }
      for (const path of paths) {
        if (this.watches.size >= MAX_CHANNELS) { break; }
        if (!this.watches.has(path)) {
          this.watches.set(path, { path, retryAt: 0, failures: 0 });
        }
      }
      if (this.watches.size === 0 || Date.now() < this.discoveryRetryAt) { return; }
      if (!this.service) { await this.discover(); }
      if (!this.active || !this.service) { return; }
      const pending = [...this.watches.values()];
      await Promise.all(Array.from({ length: Math.min(4, pending.length) }, async () => {
        while (this.active && pending.length) {
          const watch = pending.shift();
          if (watch.renewAt && Date.now() >= watch.renewAt) { await this.close(watch); }
          if (this.current(watch) && !watch.socket && !watch.pending && Date.now() >= watch.retryAt) {
            await this.subscribe(watch);
          }
        }
      }));
    } catch {
      this.discoveryRetryAt = Date.now() + 30000;
      log('[Solid] Notifications unavailable; periodic resource checks continue.');
    } finally {
      this.reconciling = false;
      if (this.again) { this.again = false; this.schedule(); }
    }
  }

  /** Pace foreground/online recovery; exact live notifications remain immediate. */
  private drainRecovery (): void {
    if (!this.active || this.recoveryTimer) { return; }
    let count = 0;
    for (const path of this.recoveryQueue) {
      this.recoveryQueue.delete(path);
      if (this.rs.access.checkPathPermission(path, 'r') &&
          this.rs.caching.checkPath(path) !== 'FLUSH') { this.rs.sync?.refreshRemote(path); }
      if (++count >= RECOVERY_BATCH) { break; }
    }
    if (this.recoveryQueue.size) {
      this.recoveryTimer = setTimeout(() => {
        this.recoveryTimer = undefined;
        this.drainRecovery();
      }, 1000);
    }
  }

  private async request (url: string, init: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    this.controllers.add(controller);
    const timer = setTimeout(() => controller.abort(), Math.min(config.requestTimeout, 10000));
    try {
      return await this.solid.session.fetch(endpoint(url), {
        ...init, cache: 'no-store', signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
      this.controllers.delete(controller);
    }
  }

  private async discover (): Promise<void> {
    const root = this.solid.getFileURL('/');
    const response = await this.request(root, { method: 'HEAD' });
    if (!response.ok) { throw new Error('Solid notification discovery failed.'); }
    const descriptions: string[] = [];
    for (const link of (response.headers.get('Link') || '').split(/,(?=\s*<)/)) {
      const target = link.match(/<([^>]+)>/);
      const rel = link.match(/;\s*rel\s*=\s*(?:"([^"]+)"|([^;\s]+))/i);
      if (target && rel && (rel[1] || rel[2]).split(/\s+/).some(value =>
        value === 'describedby' || value === STORAGE_DESCRIPTION)) {
        descriptions.push(endpoint(new URL(target[1], root).href));
      }
    }
    for (const url of descriptions) {
      const dataset = await getSolidDataset(url, { fetch: (input, init) => this.request(String(input), init) });
      const things = getThingAll(dataset);
      const subscriptions = things.flatMap(thing => getUrlAll(thing, NOTIFY + 'subscription'));
      const service = things.find(thing => subscriptions.includes(thing.url) &&
        getUrlAll(thing, NOTIFY + 'channelType').includes(CHANNEL_TYPE));
      if (service) {
        this.service = endpoint(service.url);
        this.features = getUrlAll(service, NOTIFY + 'feature');
        return;
      }
    }
    // Retry discovery: provider configuration or access may change later.
    this.discoveryRetryAt = Date.now() + 60000;
  }

  private current (watch: Watch): boolean {
    return this.active && this.watches.get(watch.path) === watch;
  }

  private async subscribe (watch: Watch): Promise<void> {
    watch.pending = true;
    try {
      const topic = this.solid.getFileURL(watch.path);
      const response = await this.request(this.service, {
        method: 'POST', headers: { 'Content-Type': 'application/ld+json' },
        body: JSON.stringify({
          '@context': ['https://www.w3.org/ns/solid/notification/v1'],
          type: CHANNEL_TYPE, topic,
          ...(this.features.includes(NOTIFY + 'endAt') ? { endAt: new Date(Date.now() + RENEW_AFTER).toISOString() } : {})
        })
      });
      if (!response.ok) { throw new Error('Solid notification subscription failed.'); }
      const channel = await response.json();
      watch.channel = endpoint(channel.id);
      if (!this.current(watch)) { await this.close(watch); return; }
      const socket = new WebSocket(endpoint(channel.receiveFrom, true));
      watch.socket = socket;
      watch.renewAt = Math.min(Date.now() + RENEW_AFTER,
        Date.parse(channel.endAt) || Infinity);
      socket.onopen = () => {
        if (!this.current(watch) || watch.socket !== socket) { return; }
        watch.failures = 0;
        watch.renewAt = Math.min(Date.now() + RENEW_AFTER, Date.parse(channel.endAt) || Infinity);
        // Subscribe first, then revalidate to cover the initial-read/subscribe
        // gap and any updates missed while the socket was disconnected.
        this.rs.sync?.refreshRemote(watch.path);
        watch.opened = true;
      };
      socket.onmessage = event => {
        if (watch.socket === socket) { this.receive(watch, event.data); }
      };
      socket.onclose = () => {
        if (this.current(watch) && watch.socket === socket) { void this.failed(watch); }
      };
      socket.onerror = () => {
        if (this.current(watch) && watch.socket === socket) { void this.failed(watch); }
      };
      // A handshake may hang without onopen/onclose; maintenance renews it.
      watch.renewAt = Math.min(watch.renewAt, Date.now() + 30000);
    } catch {
      if (this.current(watch)) { await this.failed(watch); }
    } finally {
      watch.pending = false;
    }
  }

  private receive (watch: Watch, data: unknown): void {
    if (!this.current(watch) || typeof data !== 'string') { return; }
    try {
      const message = JSON.parse(data);
      const topic = this.solid.getFileURL(watch.path);
      const object = typeof message.object === 'string' ? message.object : message.object?.id;
      const targets = Array.isArray(message.target) ? message.target : [message.target];
      const types = Array.isArray(message.type) ? message.type : [message.type];
      const membership = types.some(type => ['Add', 'Remove', 'https://www.w3.org/ns/activitystreams#Add',
        'https://www.w3.org/ns/activitystreams#Remove'].includes(type));
      // Never turn an unsolicited object URL into an authenticated fetch.
      if (object === topic || (membership && watch.path.endsWith('/') &&
          targets.some(target => (typeof target === 'string' ? target : target?.id) === topic))) {
        this.rs.sync?.refreshRemote(watch.path);
      }
    } catch { /* Malformed messages do not interrupt sync or recovery. */ }
  }

  private async failed (watch: Watch): Promise<void> {
    watch.failures++;
    watch.retryAt = Date.now() + Math.min(60000, 1000 * 2 ** Math.min(watch.failures, 6));
    await this.close(watch);
  }

  private async close (watch: Watch): Promise<void> {
    const socket = watch.socket;
    watch.socket = undefined;
    watch.opened = false;
    watch.renewAt = undefined;
    if (socket) {
      socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
      socket.close();
    }
    const channel = watch.channel;
    watch.channel = undefined;
    // Only use CSS's capability deletion convention beneath the discovered
    // service. A channel response must not turn cleanup into an arbitrary DELETE.
    if (channel && this.service && channel.startsWith(this.service.replace(/\/?$/, '/'))) {
      // CSS supports DELETE of the capability channel URL. Other providers may
      // reject it; requested expiry and local shutdown still bound its lifetime.
      try { await this.request(channel, { method: 'DELETE' }); }
      catch { log('[Solid] Could not remove notification channel; it may expire on the server.'); }
    }
  }

  async stop (): Promise<void> {
    this.active = false;
    clearInterval(this.timer);
    clearTimeout(this.scheduled);
    clearTimeout(this.recoveryTimer);
    this.recoveryQueue.clear();
    this.rs.removeEventListener('sync-done', this.onSync);
    window.removeEventListener('online', this.onOnline);
    document.removeEventListener('visibilitychange', this.onVisible);
    for (const controller of this.controllers) { controller.abort(); }
    const watches = [...this.watches.values()];
    this.watches.clear();
    await Promise.all(watches.map(watch => this.close(watch)));
  }
}

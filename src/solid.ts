import { InMemoryStorage, Session } from '@inrupt/solid-client-authn-browser';
import { getContainedResourceUrlAll, getPodUrlAll, getSolidDataset } from '@inrupt/solid-client';
import type RemoteStorage from './remotestorage';
import { RemoteBase } from './remote';
import type { Remote, RemoteResponse, RemoteSettings } from './remote';
import config from './config';
import { cleanPath, getJSONFromLocalStorage, localStorageAvailable } from './util';
import SolidStorage from './solid-storage';

const SETTINGS_KEY = 'remotestorage:solid';
type Conditions = { ifMatch?: string; ifNoneMatch?: string };
type Listing = { [name: string]: { ETag: string; 'Content-Length'?: number; 'Last-Modified'?: string } };

function httpURL (value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
    throw new Error('Solid requires HTTPS (or HTTP on localhost for development).');
  }
  if (url.username || url.password || url.hash || url.search) {
    throw new Error('Solid URLs must not contain credentials, queries, or fragments.');
  }
  return url;
}

/**
 * Solid storage adapter, included only in the optional Solid entry point.
 * Login uses the Inrupt browser SDK; file operations use its authenticated
 * fetch so HTTP preconditions and ETags retain their server-side meaning.
 * Based on the Solid adapter contributed in PR #1319.
 */
export class Solid extends RemoteBase implements Remote {
  authURL: string | null = null;
  podURLs: string[] | null = null;
  selectedPodURL: string | null = null;
  session: Session;
  private active = true;
  private appHash: string | null = null;

  constructor (rs: RemoteStorage) {
    super(rs);
    this.online = true;
    this.addEvents(['connected', 'not-connected']);
    const storage = localStorageAvailable() ? new SolidStorage(localStorage) : new InMemoryStorage();
    this.session = new Session({ secureStorage: new InMemoryStorage(), insecureStorage: storage }, 'remotestorage');
    const settings = getJSONFromLocalStorage(SETTINGS_KEY);
    if (settings) {
      this.authURL = settings.href || null;
      this.selectedPodURL = settings.properties?.podURL || null;
      this.appHash = typeof settings.properties?.appHash === 'string' ? settings.properties.appHash : null;
    }
  }

  private saveSettings (): void {
    if (localStorageAvailable()) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        href: this.authURL, properties: { podURL: this.selectedPodURL, appHash: this.appHash }
      }));
    }
  }

  /** @internal */
  configure (settings: RemoteSettings): void {
    if (settings.userAddress !== undefined) {
      this.userAddress = settings.userAddress;
    }
    if (settings.href !== undefined) {
      this.authURL = settings.href;
    }
    if (settings.properties === null) {
      this.active = false;
      this.connected = false;
      this.podURLs = null;
      this.selectedPodURL = null;
      if (localStorageAvailable()) {
        localStorage.removeItem(SETTINGS_KEY);
      }
    } else {
      this.saveSettings();
    }
  }

  /** Set the user's Solid identity provider before calling connect(). */
  setAuthURL (authURL: string): void {
    this.authURL = httpURL(authURL).href;
  }

  /** Available pods after authentication, including an empty array for no pods. */
  getPodURLs (): string[] | null {
    return this.podURLs?.slice() ?? null;
  }

  /** Currently selected pod, or null while pod selection is pending. */
  getPodURL (): string | null {
    return this.selectedPodURL;
  }

  /** Select a discovered pod, or clear the selection without logging out. */
  setPodURL (podURL: string | null): void {
    if (!this.session.info.isLoggedIn || this.podURLs === null) {
      throw new Error('Authenticate with Solid before selecting a pod.');
    }
    if (podURL !== null && !this.podURLs.includes(podURL)) {
      throw new Error('Select a pod returned by getPodURLs().');
    }
    if (podURL !== null) {
      const url = httpURL(podURL);
      if (!url.pathname.endsWith('/')) {
        throw new Error('A Solid pod URL must end with a slash.');
      }
    }
    this.selectedPodURL = podURL;
    this.connected = podURL !== null;
    this.saveSettings();
    if (this.connected) {
      this._emit('connected');
    } else {
      this.rs._emit('pod-not-selected');
    }
  }

  /** Start browser login. Register pod-not-selected and error listeners first. */
  async connect (): Promise<void> {
    if (!this.authURL) {
      this.rs._emit('error', new Error('No authURL is configured.'));
      return;
    }
    this.rs.setBackend('solid');
    try {
      const redirect = new URL(window.location.href);
      this.appHash = redirect.hash;
      redirect.hash = '';
      this.saveSettings();
      await this.session.login({
        oidcIssuer: this.authURL, redirectUrl: redirect.href, clientName: 'remoteStorage'
      });
    } catch (error) {
      this.rs._emit('error', error);
    }
  }

  /** The authenticated Inrupt session, or null before login completes. */
  getSession (): Session | null {
    return this.session.info.isLoggedIn ? this.session : null;
  }

  /** Derive a resource URL within the selected pod. */
  getFileURL (path: string): string {
    if (!this.selectedPodURL) {
      throw new Error('No Solid pod is selected.');
    }
    const relative = path.replace(/^\//, '');
    if (relative.split('/').some(part => part === '.' || part === '..')) {
      throw new Error('Solid resource paths must not contain dot segments.');
    }
    return this.selectedPodURL + cleanPath(relative);
  }

  /** Resource URL for BaseClient; this does not grant public access. */
  async getItemURL (path: string): Promise<string | undefined> {
    return this.connected ? this.getFileURL(path) : undefined;
  }

  private async request (url: string, options: RequestInit = {}): Promise<Response> {
    if (!this.connected) {
      throw new Error('Solid is not connected.');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.requestTimeout);
    try {
      // The sync engine owns freshness and validators. Browser HTTP caching
      // must not replay an older body or folder listing after a pod mutation.
      const response = await this.session.fetch(url, { ...options, cache: 'no-store', signal: controller.signal });
      if (!this.online) {
        this.online = true;
        this.rs._emit('network-online');
      }
      return response;
    } catch (error) {
      if (this.online) {
        this.online = false;
        this.rs._emit('network-offline');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private conditions (options: Conditions): Headers {
    const headers = new Headers();
    if (options.ifMatch) {
      headers.set('If-Match', this.validator(options.ifMatch));
    }
    if (options.ifNoneMatch) {
      headers.set('If-None-Match', this.validator(options.ifNoneMatch));
    }
    return headers;
  }

  private validator (revision: string): string {
    return revision === '*' || revision.startsWith('W/"') || revision.startsWith('"')
      ? revision : this.addQuotes(revision);
  }

  private result (response: Response): RemoteResponse {
    return {
      statusCode: response.status,
      revision: this.stripQuotes(response.headers.get('ETag')) || undefined
    };
  }

  private requireRevision (response: Response, url: string): string {
    const etag = response.headers.get('ETag');
    if (!etag) {
      throw new Error('Solid resource must expose an ETag for safe synchronization: ' + url);
    }
    if (!url.endsWith('/') && etag.startsWith('W/')) {
      throw new Error('Solid files require strong ETags for conditional writes: ' + url);
    }
    return this.stripQuotes(etag);
  }

  private async getFolder (url: string): Promise<RemoteResponse> {
    let response: Response;
    const dataset = await getSolidDataset(url, { fetch: async (input, init) => {
      response = await this.request(String(input), init);
      return response;
    } });
    const listing: Listing = {};
    const children = getContainedResourceUrlAll(dataset);
    // Bound metadata requests; use real ETags rather than treating mtime as an
    // HTTP validator. Optional RDF stat metadata is not required by Solid.
    const workers = Array.from({ length: Math.min(4, children.length) }, async () => {
      while (children.length > 0) {
        const child = children.shift();
        const name = decodeURIComponent(child.substring(url.length));
        if (!child.startsWith(url) || !name || name.replace(/\/$/, '').includes('/')) {
          throw new Error('Invalid resource in Solid container: ' + child);
        }
        const meta = await this.request(child, { method: 'HEAD' });
        if (meta.status === 404) { continue; } // Deleted during listing.
        if (!meta.ok) {
          throw Object.assign(new Error('Solid metadata request failed: ' + meta.status), { response: meta });
        }
        const item: Listing[string] = { ETag: this.requireRevision(meta, child) };
        const modified = meta.headers.get('Last-Modified');
        if (modified) { item['Last-Modified'] = modified; }
        const length = meta.headers.get('Content-Length');
        if (length !== null && !name.endsWith('/')) { item['Content-Length'] = Number(length); }
        // Define an own property even for filenames such as __proto__.
        Object.defineProperty(listing, name, { value: item, enumerable: true });
      }
    });
    await Promise.all(workers);
    return { ...this.result(response), body: listing, contentType: 'application/json; charset=UTF-8' };
  }

  /** Read a file or list a container, preserving binary content and revisions. */
  async get (path: string, options: Conditions = {}): Promise<RemoteResponse> {
    const url = this.getFileURL(path);
    if (path.endsWith('/')) {
      try {
        return await this.getFolder(url);
      } catch (error) {
        const response = (error as { response?: Response }).response;
        if (response) {
          return this.result(response);
        }
        throw error;
      }
    }
    const response = await this.request(url, { headers: this.conditions(options) });
    const result = this.result(response);
    if (response.status !== 200) { return result; }
    result.revision = this.requireRevision(response, url);
    result.contentType = response.headers.get('Content-Type') || 'application/octet-stream';
    const mime = result.contentType.split(';')[0].trim().toLowerCase();
    result.body = mime.startsWith('text/') || /(?:\/json|\+json|\/xml|\+xml|\/javascript)$/.test(mime)
      ? await response.text() : await response.arrayBuffer();
    return result;
  }

  /** Write with atomic server-side If-Match/If-None-Match preconditions. */
  async put (path: string, body: XMLHttpRequestBodyInit, contentType: string, options: Conditions = {}): Promise<RemoteResponse> {
    if (path.endsWith('/')) { throw new Error('Do not PUT Solid containers.'); }
    const headers = this.conditions(options);
    headers.set('Content-Type', contentType);
    const response = await this.request(this.getFileURL(path), { method: 'PUT', headers, body: body as BodyInit });
    const result = this.result(response);
    // Solid servers may return 204 or 205 on updates. BaseClient's write API
    // expects 200/201, so normalize successful mutations at the adapter edge.
    if (response.ok) { result.statusCode = 201; }
    // PUT may succeed without returning a validator. Do not HEAD afterwards:
    // another writer may already have changed the resource, and associating
    // that writer's revision with our body would allow a later lost update.
    return result;
  }

  /** Delete with an atomic server-side If-Match precondition. */
  async delete (path: string, options: Conditions = {}): Promise<RemoteResponse> {
    if (path.endsWith('/')) { throw new Error('Do not DELETE Solid containers.'); }
    const response = await this.request(this.getFileURL(path), {
      method: 'DELETE', headers: this.conditions(options)
    });
    return response.ok || response.status === 404 ? { statusCode: 200 } : this.result(response);
  }

  private async restore (): Promise<void> {
    await this.session.handleIncomingRedirect({ restorePreviousSession: true });
    if (!this.active || !this.session.info.isLoggedIn) { return; }
    if (this.appHash !== null) {
      const url = new URL(window.location.href);
      url.hash = this.appHash;
      window.history.replaceState(null, '', url.href);
      this.appHash = null;
      this.saveSettings();
    }
    this.userAddress = this.session.info.webId;
    const podURLs = await getPodUrlAll(this.userAddress, { fetch: this.session.fetch });
    if (!this.active) { return; }
    this.podURLs = podURLs;
    if (this.selectedPodURL && this.podURLs.includes(this.selectedPodURL)) {
      this.setPodURL(this.selectedPodURL);
    } else {
      this.setPodURL(null);
    }
  }

  /** @internal */
  static _rs_supported (): boolean {
    return typeof window !== 'undefined' && typeof fetch === 'function' && localStorageAvailable();
  }

  /** @internal */
  static async _rs_init (rs: RemoteStorage): Promise<void> {
    const solid = new Solid(rs);
    rs.solid = solid;
    if (rs.backend !== 'solid') { return; }
    rs.remote = solid;
    try {
      await solid.restore();
    } catch (error) {
      rs._emit('error', error);
    }
  }

  /** @internal */
  static async _rs_cleanup (rs: RemoteStorage): Promise<void> {
    const solid = rs.solid;
    if (!(solid instanceof Solid)) { return; }
    const wasActive = rs.remote === solid || rs.backend === 'solid';
    if (wasActive) { rs.setBackend(undefined); }
    solid.active = false;
    solid.connected = false;
    try {
      if (solid.session.info.isLoggedIn || wasActive) {
        await solid.session.logout();
      }
    } catch (error) {
      rs._emit('error', error);
    } finally {
      if (localStorageAvailable()) { localStorage.removeItem(SETTINGS_KEY); }
    }
  }
}

export default Solid;

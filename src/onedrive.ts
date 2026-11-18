import type RemoteStorage from './remotestorage';
import { RemoteBase, Remote, RemoteResponse, RemoteSettings } from './remote';
import Authorize from './authorize';
import { generateCodeVerifier, localStorageAvailable, getJSONFromLocalStorage } from './util';
import { DriveItem, DeltaPage, OneDriveIndex, graphURL, parentPath, validateName } from './onedrive-index';
import config from './config';
import UnauthorizedError from './unauthorized-error';

const SETTINGS = 'remotestorage:onedrive';
const LOGIN = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/';
const GRAPH = 'https://graph.microsoft.com/v1.0/me/drive';
const ROOT = 'remotestorage';
const SCOPE = 'Files.ReadWrite offline_access';
const CHUNK_SIZE = 10 * 327680;

/** Validate preauthenticated URLs without forwarding Graph bearer credentials. */
function capabilityURL (value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new Error('Invalid OneDrive transfer URL');
  }
  return url.href;
}

function revision (item: DriveItem): string {
  if (!item.eTag || item.eTag.startsWith('W/')) { throw new Error('OneDrive did not return a strong ETag'); }
  return item.eTag.replace(/^"|"$/g, '');
}

/** Encode literal remoteStorage names once for Graph path addressing. */
function graphPath (path: string): string {
  if (!path.startsWith('/') || path.includes('//')) { throw new Error('Invalid OneDrive path'); }
  return path.split('/').filter(Boolean).map(segment => {
    const name = validateName(segment);
    return encodeURIComponent(name).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  }).join('/');
}

/**
 * OneDrive Personal storage with a shared /remotestorage directory, PKCE login,
 * delta-based recursive revisions and conditional deferred-upload commits.
 */
export class OneDrive extends RemoteBase implements Remote {
  clientId: string;
  token?: string;
  refreshToken?: string;
  TOKEN_URL = LOGIN + 'token';
  private generation = 0;
  private active = true;
  private controllers = new Set<AbortController>();
  private refresh?: Promise<void>;
  private preparing?: Promise<void>;
  private rootId?: string;
  private index = new OneDriveIndex();
  private previousRemote?: Remote;

  constructor (rs: RemoteStorage) {
    super(rs);
    this.clientId = rs.apiKeys.onedrive.clientId;
    this.online = true;
    this.addEvents(['connected', 'not-connected']);
    const settings = localStorageAvailable() && getJSONFromLocalStorage(SETTINGS);
    if (settings) {
      const generation = this.generation;
      setTimeout(() => {
        if (this.active && generation === this.generation && rs.backend === 'onedrive' && !this.token) { void this.configure(settings); }
      }, 0);
    }
  }

  async connect (): Promise<void> {
    if (!localStorageAvailable() || typeof sessionStorage === 'undefined') { throw new Error('OneDrive login requires browser storage'); }
    const generation = this.generation;
    const { codeVerifier, codeChallenge, state } = await generateCodeVerifier();
    this.checkSession(generation);
    this.rs.setBackend('onedrive');
    this.select();
    Authorize.savePkceTransaction({ codeVerifier, state, tokenURL: this.TOKEN_URL, clientId: this.clientId,
      appState: Authorize.getLocation().hash.slice(1) });
    this.rs.authorize({ authURL: LOGIN + 'authorize', scope: SCOPE, clientId: this.clientId,
      response_type: 'code', state, code_challenge: codeChallenge, code_challenge_method: 'S256' });
  }

  private select (): void {
    if (this.rs.remote !== this) { this.previousRemote = this.rs.remote; this.rs.remote = this; }
  }

  async configure (settings: RemoteSettings): Promise<void> {
    if (!this.active) { throw new Error('OneDrive session ended'); }
    const generation = ++this.generation;
    for (const controller of this.controllers) { controller.abort(); }
    this.index = new OneDriveIndex();
    this.rootId = undefined;
    this.preparing = undefined;
    this.refresh = undefined;
    if (settings.token !== undefined && settings.token !== this.token && settings.refreshToken === undefined) {
      this.refreshToken = undefined;
    }
    if (settings.token !== undefined) { this.token = settings.token || undefined; }
    if (settings.refreshToken !== undefined) { this.refreshToken = settings.refreshToken || undefined; }
    if (settings.token === null) { this.refreshToken = undefined; }
    this.connected = false;
    this.userAddress = undefined;
    if (settings.token === null || (!this.token && !this.refreshToken)) { this.persist(); return; }
    try {
      const response = await this.request(GRAPH);
      const drive = await this.json(response);
      this.checkSession(generation);
      if (typeof drive?.driveType !== 'string') { throw new Error('Invalid OneDrive account metadata'); }
      if (drive.driveType !== 'personal') {
        this.token = this.refreshToken = undefined;
        throw new Error('This OneDrive backend currently supports Personal accounts only');
      }
      this.userAddress = drive.owner?.user?.email || drive.owner?.user?.displayName || 'OneDrive';
      this.connected = true;
      this.persist();
      this._emit('connected');
    } catch (error) {
      if (this.active && this.generation === generation) {
        if (error instanceof UnauthorizedError) { this.token = this.refreshToken = undefined; }
        this.persist();
        this.rs._emit('error', error);
        this._emit('not-connected');
      }
    }
  }

  private persist (): void {
    if (!localStorageAvailable()) { return; }
    if (!this.token && !this.refreshToken) { localStorage.removeItem(SETTINGS); }
    else { localStorage.setItem(SETTINGS, JSON.stringify({ token: this.token, refreshToken: this.refreshToken })); }
  }

  private checkSession (generation: number): void {
    if (!this.active || generation !== this.generation) { throw new Error('OneDrive session ended'); }
  }

  private async renewToken (generation: number): Promise<void> {
    if (!this.refreshToken) { throw new UnauthorizedError('OneDrive sign-in expired'); }
    if (!this.refresh) {
      const token = this.refreshToken;
      const pending = Authorize.requestRefreshedToken(this.TOKEN_URL, this.clientId, token).then(result => {
        this.checkSession(generation);
        this.token = result.token;
        this.refreshToken = result.refreshToken || token;
        this.persist();
      }).catch(error => {
        if (this.active && this.generation === generation && error instanceof UnauthorizedError) {
          this.token = this.refreshToken = undefined;
          this.connected = false;
          this.persist();
        }
        throw error;
      });
      this.refresh = pending;
      void pending.finally(() => { if (this.refresh === pending) { this.refresh = undefined; } }).catch(() => undefined);
    }
    await this.refresh;
  }

  private async request (url: string, init: RequestInit = {}, authenticated = true): Promise<Response> {
    const generation = this.generation;
    this.checkSession(generation);
    url = authenticated ? graphURL(url) : capabilityURL(url);
    if (authenticated && !this.token) { await this.renewToken(generation); }
    this.checkSession(generation);
    const controller = new AbortController();
    this.controllers.add(controller);
    const aborted = new Promise<never>((_resolve, reject) => {
      controller.signal.addEventListener('abort', () => reject(controller.signal.reason), { once: true });
    });
    const timer = setTimeout(() => controller.abort(new Error('OneDrive request timed out')), config.requestTimeout);
    const send = async (): Promise<Response> => {
      this.checkSession(generation);
      if (controller.signal.aborted) { throw controller.signal.reason; }
      const response = await fetch(url, { ...init, credentials: 'omit', cache: 'no-store',
        redirect: authenticated ? 'error' : 'follow', signal: controller.signal,
        headers: { ...init.headers, ...(authenticated ? { Authorization: 'Bearer ' + this.token } : {}) } });
      // Keep cancellation and timeout active until the body has arrived too.
      const bytes = await response.arrayBuffer();
      this.checkSession(generation);
      if (controller.signal.aborted) { throw controller.signal.reason; }
      return new Response([204, 205, 304].includes(response.status) ? null : bytes, {
        status: response.status, statusText: response.statusText, headers: response.headers
      });
    };
    const sentToken = this.token;
    try {
      const operation = async () => {
        let response = await send();
        this.checkSession(generation);
        if (authenticated && response.status === 401 && this.refreshToken) {
          if (this.token === sentToken) { await this.renewToken(generation); }
          this.checkSession(generation);
          response = await send();
        }
        if (authenticated && response.status === 401) { throw new UnauthorizedError('OneDrive authorization failed (401)'); }
        return response;
      };
      const response = await Promise.race([operation(), aborted]);
      this.online = true;
      return response;
    } catch (error) {
      this.checkSession(generation);
      if (!(error instanceof UnauthorizedError)) { this.online = false; }
      throw error;
    } finally { clearTimeout(timer); this.controllers.delete(controller); }
  }

  // Graph error payloads may contain signed URLs; expose only the status.
  private async json (response: Response): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (response.status === 401) { throw new UnauthorizedError('OneDrive authorization failed (401)'); }
    if (!response.ok) { throw new Error('OneDrive request failed (' + response.status + ')'); }
    return response.json();
  }

  private async isConflict (response: Response, ifMatch?: string): Promise<boolean> {
    if (response.status === 412 || (response.status === 404 && !!ifMatch)) { return true; }
    if (response.status !== 409) { return false; }
    // Quota and other unrelated 409 failures must not be treated as data conflicts.
    const error = await response.clone().json().catch(() => undefined);
    return error?.error?.code === 'nameAlreadyExists';
  }

  private itemURL (path: string): string {
    const encoded = graphPath(path);
    return GRAPH + '/root:/' + ROOT + (encoded ? '/' + encoded : '');
  }

  private async metadata (path: string, generation = this.generation): Promise<DriveItem | undefined> {
    this.checkSession(generation);
    const response = await this.request(this.itemURL(path));
    this.checkSession(generation);
    if (response.status === 404) { return undefined; }
    const item = await this.json(response);
    this.checkSession(generation);
    return item;
  }

  private async ensureFolder (path: string, generation = this.generation): Promise<DriveItem> {
    const existing = await this.metadata(path, generation);
    if (existing) {
      if (!existing.folder) { throw new Error('A file occupies the OneDrive folder path'); }
      return existing;
    }
    const parent = path === '/' ? undefined : await this.ensureFolder(parentPath(path), generation);
    this.checkSession(generation);
    const name = path === '/' ? ROOT : path.split('/').filter(Boolean).pop();
    const url = parent ? GRAPH + '/items/' + encodeURIComponent(parent.id) + '/children' : GRAPH + '/root/children';
    const response = await this.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }) });
    if (response.status === 409) {
      const raced = await this.metadata(path, generation);
      if (raced?.folder) { return raced; }
    }
    return this.json(response);
  }

  /** Consume all delta pages before sync trusts synthesized ancestor revisions. */
  async prepareSync (): Promise<void> {
    if (!this.connected) { throw new Error('OneDrive is not connected'); }
    if (this.preparing) { return this.preparing; }
    const generation = this.generation;
    const pending = (async () => {
      const root = await this.metadata('/');
      this.checkSession(generation);
      if (!root) { this.index = new OneDriveIndex(); this.rootId = undefined; return; }
      if (!root.folder) { throw new Error('OneDrive /remotestorage must be a folder'); }
      if (root.id !== this.rootId) { this.index = new OneDriveIndex(); this.rootId = root.id; }
      const index = this.index;
      const readPage = async (url: string): Promise<DeltaPage> => {
        const response = await this.request(url);
        this.checkSession(generation);
        if (response.status === 410) { throw Object.assign(new Error('OneDrive delta expired'), { resetDelta: true }); }
        const page = await this.json(response);
        this.checkSession(generation);
        return page;
      };
      try { await index.update(root.id, readPage); }
      catch (error) {
        if (!error.resetDelta) { throw error; }
        const replacement = new OneDriveIndex();
        await replacement.update(root.id, readPage);
        this.checkSession(generation);
        this.index = replacement;
      }
      this.checkSession(generation);
    })();
    this.preparing = pending;
    try { await pending; }
    finally { if (this.preparing === pending) { this.preparing = undefined; } }
  }

  async get (path: string, options: { ifNoneMatch?: string } = {}): Promise<RemoteResponse> {
    const generation = this.generation;
    graphPath(path);
    if (!this.connected) { throw new Error('OneDrive is not connected'); }
    if (path.endsWith('/')) { return this.getFolder(path, options); }
    // Metadata and download are separate requests. Verify again to avoid
    // associating a newer download with an older validator.
    for (let attempt = 0; attempt < 3; attempt++) {
      const item = await this.metadata(path, generation);
      this.checkSession(generation);
      if (!item || item.folder) { return { statusCode: 404 }; }
      const tag = revision(item);
      if (tag === options.ifNoneMatch) { return { statusCode: 304, revision: tag }; }
      const download = await this.request(item['@microsoft.graph.downloadUrl'], {}, false);
      if (!download.ok) { throw new Error('OneDrive download failed (' + download.status + ')'); }
      const bytes = await download.arrayBuffer();
      const after = await this.metadata(path, generation);
      this.checkSession(generation);
      if (!after || after.folder || after.id !== item.id || revision(after) !== tag) { continue; }
      const contentType = item.file?.mimeType || 'application/octet-stream';
      const textual = /^(text\/|application\/(json|[^;]+\+json|xml|[^;]+\+xml)(;|$))/i.test(contentType);
      const body = textual ? new TextDecoder('utf-8', { fatal: true }).decode(bytes) : bytes;
      return { statusCode: 200, body: body as RemoteResponse['body'], contentType, revision: tag };
    }
    throw new Error('OneDrive file kept changing during download');
  }

  private async getFolder (path: string, options: { ifNoneMatch?: string }): Promise<RemoteResponse> {
    const generation = this.generation;
    await this.prepareSync();
    this.checkSession(generation);
    path = [...this.index.revisions.keys()].find(candidate => candidate.toLowerCase() === path.toLowerCase()) || path;
    const tag = this.index.revisions.get(path);
    if (!tag) { return { statusCode: 404 }; }
    if (options.ifNoneMatch === tag) { return { statusCode: 304, revision: tag }; }
    const body = Object.create(null);
    for (const [child, item] of this.index.paths) {
      if (child !== path && parentPath(child) === path) {
        body[child.slice(path.length)] = { ETag: item.folder ? this.index.revisions.get(child) : revision(item),
          ...(!item.folder ? { 'Content-Type': item.file?.mimeType || 'application/octet-stream', 'Content-Length': item.size } : {}) };
      }
    }
    return { statusCode: 200, body, contentType: 'application/json; charset=UTF-8', revision: tag };
  }

  async put (path: string, body: XMLHttpRequestBodyInit, contentType: string,
    options: { ifMatch?: string; ifNoneMatch?: string } = {}): Promise<RemoteResponse> {
    const generation = this.generation;
    graphPath(path);
    if (path.endsWith('/')) { throw new Error('OneDrive document writes require a file path'); }
    if (!this.connected) { throw new Error('OneDrive is not connected'); }
    if (options.ifNoneMatch && options.ifNoneMatch !== '*') { throw new Error('OneDrive only supports If-None-Match: * for creation'); }
    const bytes = await new Response(body as BodyInit).arrayBuffer();
    if (!bytes.byteLength) { throw new Error('Empty OneDrive uploads are not supported by the conditional upload-session path'); }
    const parent = await this.ensureFolder(parentPath(path), generation);
    this.checkSession(generation);
    const name = path.split('/').pop();
    const target = GRAPH + '/items/' + encodeURIComponent(parent.id) + ':/' + graphPath('/' + path.split('/').pop());
    const headers = { 'Content-Type': 'application/json', ...(options.ifMatch ? { 'If-Match': this.addQuotes(options.ifMatch) } : {}) };
    const conflict = options.ifNoneMatch === '*' ? 'fail' : 'replace';
    const session = await this.request(target + ':/createUploadSession', { method: 'POST', headers,
      body: JSON.stringify({ deferCommit: true, item: { name, '@microsoft.graph.conflictBehavior': conflict } }) });
    if (await this.isConflict(session, options.ifMatch)) { return { statusCode: 412 }; }
    const upload = capabilityURL((await this.json(session)).uploadUrl);
    this.checkSession(generation);
    try {
      for (let offset = 0; offset < bytes.byteLength; offset += CHUNK_SIZE) {
        this.checkSession(generation);
        const end = Math.min(offset + CHUNK_SIZE, bytes.byteLength);
        const response = await this.request(upload, { method: 'PUT', headers: {
          'Content-Type': contentType, 'Content-Range': `bytes ${offset}-${end - 1}/${bytes.byteLength}`
        }, body: bytes.slice(offset, end) }, false);
        // deferCommit must prevent the content upload itself from publishing.
        if (response.status !== 202) { throw new Error('OneDrive did not defer the upload commit (' + response.status + ')'); }
      }
      this.checkSession(generation);
      // Microsoft's explicit-commit flow addresses the destination parent;
      // the new item's name is supplied in the driveItem body.
      const committed = await this.request(this.itemURL(parentPath(path)), { method: 'PUT', headers, body: JSON.stringify({
        name, '@microsoft.graph.conflictBehavior': conflict, '@microsoft.graph.sourceUrl': upload
      }) });
      if (await this.isConflict(committed, options.ifMatch)) { return { statusCode: 412 }; }
      if (committed.status !== 200 && committed.status !== 201) { throw new Error('OneDrive commit failed (' + committed.status + ')'); }
      const item = await this.json(committed);
      this.checkSession(generation);
      return { statusCode: committed.status, revision: revision(item) };
    } finally {
      // Capability DELETE cancels only this upload session, never a user file.
      try { await this.request(upload, { method: 'DELETE' }, false); } catch { /* Session expiry is the fallback. */ }
      this.checkSession(generation);
    }
  }

  async delete (path: string, options: { ifMatch?: string } = {}): Promise<RemoteResponse> {
    const generation = this.generation;
    graphPath(path);
    if (path.endsWith('/')) { throw new Error('OneDrive document deletes require a file path'); }
    if (!this.connected) { throw new Error('OneDrive is not connected'); }
    const response = await this.request(this.itemURL(path), { method: 'DELETE',
      headers: options.ifMatch ? { 'If-Match': this.addQuotes(options.ifMatch) } : {} });
    this.checkSession(generation);
    return { statusCode: response.status === 404 && options.ifMatch ? 412 : response.status };
  }

  /** A temporary download capability, not a permanent public sharing URL. */
  async getItemURL (path: string): Promise<string | undefined> {
    const generation = this.generation;
    if (!this.connected) { throw new Error('OneDrive is not connected'); }
    const item = await this.metadata(path);
    this.checkSession(generation);
    return item && !item.folder ? capabilityURL(item['@microsoft.graph.downloadUrl']) : undefined;
  }

  private stop (): void {
    this.active = false;
    this.generation++;
    for (const controller of this.controllers) { controller.abort(); }
    this.token = this.refreshToken = undefined;
    this.connected = false;
    this.persist();
  }

  static _rs_supported (): boolean { return typeof fetch !== 'undefined' && typeof crypto !== 'undefined' && !!crypto.subtle; }

  static _rs_init (rs: RemoteStorage): void {
    if (!rs.apiKeys.onedrive) { return; }
    const previous = rs.onedrive;
    const restore = previous && rs.remote === previous ? previous.previousRemote : rs.remote;
    previous?.stop();
    rs.onedrive = new OneDrive(rs);
    if (rs.remote === previous) { rs.remote = restore; }
    if (rs.backend === 'onedrive') { rs.onedrive.select(); }
  }

  static _rs_cleanup (rs: RemoteStorage): void {
    const backend = rs.onedrive;
    if (!backend) { return; }
    backend.stop();
    if (rs.remote === backend) { rs.remote = backend.previousRemote; }
    if (rs.backend === 'onedrive') { rs.setBackend(undefined); }
  }
}

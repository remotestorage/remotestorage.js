/** The subset of Graph driveItem metadata required for path and revision tracking. */
export interface DriveItem {
  id: string;
  name?: string;
  eTag?: string;
  size?: number;
  file?: { mimeType?: string };
  folder?: object;
  root?: object;
  deleted?: object;
  parentReference?: { id?: string };
  '@microsoft.graph.downloadUrl'?: string;
}

export interface DeltaPage {
  value: DriveItem[];
  '@odata.nextLink'?: string;
  '@odata.deltaLink'?: string;
}

/** Reject unexpected Graph links before sending a bearer token. */
export function graphURL (value: string): string {
  const url = new URL(value, 'https://graph.microsoft.com/v1.0/');
  if (url.origin !== 'https://graph.microsoft.com' || !url.pathname.startsWith('/v1.0/') || url.username || url.password || url.hash) {
    throw new Error('Invalid Microsoft Graph URL');
  }
  return url.href;
}

/** remoteStorage paths contain literal names; encoding belongs at the HTTP boundary. */
export function validateName (name: string): string {
  // eslint-disable-next-line no-control-regex
  if (typeof name !== 'string' || !name || name === '.' || name === '..' || /[\\/\u0000-\u001f]/.test(name)) {
    throw new Error('Invalid OneDrive path segment');
  }
  return name;
}

/**
 * An atomic delta snapshot. IDs preserve ancestry when a folder is moved or
 * renamed without its descendants appearing in the delta response.
 */
export class OneDriveIndex {
  items = new Map<string, DriveItem>();
  paths = new Map<string, DriveItem>();
  revisions = new Map<string, string>();
  cursor?: string;

  async update (rootId: string, readPage: (url: string) => Promise<DeltaPage>): Promise<void> {
    const items = new Map(this.items);
    let url = this.cursor || 'https://graph.microsoft.com/v1.0/me/drive/root/delta';
    const seen = new Set<string>();
    const deleted = new Set<string>();
    let cursor: string;
    while (url) {
      url = graphURL(url);
      if (seen.has(url)) { throw new Error('Repeated OneDrive delta page'); }
      seen.add(url);
      const page = await readPage(url);
      if (!Array.isArray(page.value)) { throw new Error('Invalid OneDrive delta page'); }
      for (const item of page.value) {
        if (!item || typeof item.id !== 'string' || !item.id) { throw new Error('Invalid OneDrive delta item'); }
        if (item.deleted) { items.delete(item.id); deleted.add(item.id); }
        else { items.set(item.id, { ...items.get(item.id), ...item }); }
      }
      url = page['@odata.nextLink'];
      if (url !== undefined && (typeof url !== 'string' || !url)) { throw new Error('Invalid OneDrive next page link'); }
      if (!url) {
        cursor = page['@odata.deltaLink'];
        if (typeof cursor !== 'string' || !cursor) { throw new Error('Missing OneDrive delta cursor'); }
        graphURL(cursor);
      }
    }
    // Apply deletions after all pages so children moved out of a deleted folder
    // survive, while orphaned descendants cannot reappear from stale metadata.
    const orphaned = new Set<string>();
    for (const item of items.values()) {
      let parent = item.parentReference?.id;
      const ancestors = new Set<string>();
      while (parent && !ancestors.has(parent)) {
        if (deleted.has(parent) && !items.has(parent)) { orphaned.add(item.id); break; }
        ancestors.add(parent);
        parent = items.get(parent)?.parentReference?.id;
      }
    }
    for (const id of orphaned) { items.delete(id); }
    const paths = new Map<string, DriveItem>();
    const names = new Set<string>();
    const resolve = (item: DriveItem, ancestors = new Set<string>()): string => {
      if (item.id === rootId) { return '/'; }
      if (ancestors.has(item.id)) { throw new Error('Cyclic OneDrive ancestry'); }
      ancestors.add(item.id);
      const parent = items.get(item.parentReference?.id);
      if (!parent) { return undefined; }
      const parentPath = resolve(parent, ancestors);
      if (parentPath && !parent.folder) { throw new Error('Invalid OneDrive parent folder'); }
      return parentPath && parentPath + validateName(item.name) + (item.folder ? '/' : '');
    };
    for (const item of items.values()) {
      const path = resolve(item);
      if (path) {
        const name = path.replace(/\/$/, '').toLowerCase();
        if (names.has(name)) { throw new Error('Ambiguous duplicate OneDrive path'); }
        names.add(name);
        if (!item.folder && (!item.file || typeof item.eTag !== 'string' || !item.eTag || item.eTag.startsWith('W/'))) {
          throw new Error('OneDrive file is missing a supported file facet or strong ETag');
        }
        paths.set(path, item);
      }
    }
    const children = new Map<string, Array<[string, DriveItem]>>();
    for (const [path, item] of paths) {
      if (path === '/') { continue; }
      const parent = parentPath(path);
      if (!children.has(parent)) { children.set(parent, []); }
      children.get(parent).push([path, item]);
    }
    const revisions = new Map<string, string>();
    for (const path of [...paths.keys()].filter(p => p.endsWith('/')).sort((a, b) => b.length - a.length)) {
      const entries = (children.get(path) || [])
        .map(([child, item]) => [child.slice(path.length), revisions.get(child) || item.eTag || item.id]).sort();
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(entries)));
      revisions.set(path, 'onedrive-' + [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join(''));
    }
    // Publish only after every page and every ancestry/revision check succeeded.
    this.items = items;
    this.paths = paths;
    this.revisions = revisions;
    this.cursor = cursor;
  }
}

export function parentPath (path: string): string {
  return path.replace(/[^/]+\/?$/, '');
}

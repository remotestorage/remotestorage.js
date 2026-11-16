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

/** Encode decoded OneDrive names for the remoteStorage path namespace. */
export function encodeName (name: string): string {
  return encodeURIComponent(name).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
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
    let cursor: string;
    while (url) {
      url = graphURL(url);
      if (seen.has(url)) { throw new Error('Repeated OneDrive delta page'); }
      seen.add(url);
      const page = await readPage(url);
      if (!Array.isArray(page.value)) { throw new Error('Invalid OneDrive delta page'); }
      for (const item of page.value) {
        if (!item || typeof item.id !== 'string') { throw new Error('Invalid OneDrive delta item'); }
        if (item.deleted) { items.delete(item.id); }
        else { items.set(item.id, { ...items.get(item.id), ...item }); }
      }
      url = page['@odata.nextLink'];
      if (!url) {
        cursor = page['@odata.deltaLink'];
        if (!cursor) { throw new Error('Missing OneDrive delta cursor'); }
        graphURL(cursor);
      }
    }
    const paths = new Map<string, DriveItem>();
    const resolve = (item: DriveItem, ancestors = new Set<string>()): string => {
      if (item.id === rootId) { return '/'; }
      if (ancestors.has(item.id)) { throw new Error('Cyclic OneDrive ancestry'); }
      ancestors.add(item.id);
      const parent = items.get(item.parentReference?.id);
      if (!parent || !item.name) { return undefined; }
      const parentPath = resolve(parent, ancestors);
      return parentPath && parentPath + encodeName(item.name) + (item.folder ? '/' : '');
    };
    for (const item of items.values()) {
      const path = resolve(item);
      if (path) { paths.set(path, item); }
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

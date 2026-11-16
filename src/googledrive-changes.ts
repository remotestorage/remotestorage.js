interface ChangeResponse {
  status: number;
  responseText: string;
}

const CHANGES_URL = 'https://www.googleapis.com/drive/v3/changes';

/** Account-wide change cursor and conservative synthetic folder validators. @internal */
export class GoogleDriveChanges {
  revision?: string;
  // Common-cache revisions survive reloads. Do not assume opaque Drive tokens
  // are unique across accounts or reuse another instance's folder validators.
  private instance = `${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
  private token?: string;
  private serial = 0;
  private epoch = 0;
  private listed = new Set<string>();
  private pending?: Promise<void>;

  constructor (private request: (url: string) => Promise<ChangeResponse>, private onChange: () => void) {}

  reset (): void {
    this.epoch++;
    this.token = undefined;
    this.pending = undefined;
    this.invalidate();
  }

  invalidate (): void {
    this.serial++;
    this.listed.clear();
    this.revision = this.token ? `gd:${this.instance}:${this.token}:${this.serial}` : undefined;
  }

  markListed (path: string, revision: string): void {
    if (revision && revision === this.revision) { this.listed.add(path); }
  }

  getRevision (path: string): string | undefined {
    return this.listed.has(path) ? this.revision : undefined;
  }

  prepare (): Promise<void> {
    if (this.pending) { return this.pending; }
    const epoch = this.epoch;
    const pending = this.refresh(epoch).catch(error => {
      if (epoch === this.epoch) { this.invalidate(); }
      throw error;
    }).finally(() => {
      if (this.pending === pending) { this.pending = undefined; }
    });
    this.pending = pending;
    return pending;
  }

  private async read (url: string, epoch: number): Promise<ChangeResponse> {
    const response = await this.request(url);
    if (epoch !== this.epoch) { throw new Error('Google Drive session changed during change tracking.'); }
    return response;
  }

  private parse (response: ChangeResponse): Record<string, unknown> {
    if (response.status !== 200) { throw new Error(`Google Drive change tracking failed: ${response.status}`); }
    const body = JSON.parse(response.responseText);
    if (!body || typeof body !== 'object' || Array.isArray(body)) { throw new Error('Invalid Google Drive change response.'); }
    return body;
  }

  private async refresh (epoch: number): Promise<void> {
    if (!this.token) {
      const body = this.parse(await this.read(CHANGES_URL + '/startPageToken?fields=startPageToken', epoch));
      if (typeof body.startPageToken !== 'string' || !body.startPageToken) { throw new Error('Missing Google Drive start token.'); }
      this.token = body.startPageToken;
      this.invalidate();
      return;
    }
    let pageToken = this.token;
    let changed = false;
    const seen = new Set<string>();
    while (pageToken) {
      if (seen.has(pageToken)) { throw new Error('Repeated Google Drive change page token.'); }
      seen.add(pageToken);
      const response = await this.read(CHANGES_URL + '?pageToken=' + encodeURIComponent(pageToken) +
        '&pageSize=1000&includeRemoved=true&fields=nextPageToken,newStartPageToken,changes(fileId)', epoch);
      if (response.status === 410) {
        this.token = undefined;
        this.invalidate();
        this.onChange();
        return this.refresh(epoch);
      }
      const body = this.parse(response);
      if (body.changes !== undefined && !Array.isArray(body.changes)) { throw new Error('Invalid Google Drive change list.'); }
      changed ||= Array.isArray(body.changes) && body.changes.length > 0;
      if (body.nextPageToken !== undefined) {
        if (typeof body.nextPageToken !== 'string' || !body.nextPageToken) { throw new Error('Invalid Google Drive next token.'); }
        pageToken = body.nextPageToken;
      } else {
        if (typeof body.newStartPageToken !== 'string' || !body.newStartPageToken) { throw new Error('Missing Google Drive continuation token.'); }
        this.token = body.newStartPageToken;
        if (changed) {
          this.invalidate();
          this.onChange();
        }
        return;
      }
    }
  }
}

import type RemoteStorage from '../remotestorage';
import type { Remote } from '../remote';

/** Public Solid connection API without importing SDK types into the core build. */
export interface SolidBackend extends Remote {
  setAuthURL(authURL: string): void;
  getPodURLs(): string[] | null;
  getPodURL(): string | null;
  setPodURL(podURL: string | null): void;
  getSession(): unknown;
}

/** Optional feature supplied by the Solid entry point. @internal */
export interface SolidFeature {
  new(rs: RemoteStorage): SolidBackend;
  _rs_supported(): boolean;
  _rs_init(rs: RemoteStorage): Promise<void>;
  _rs_cleanup(rs: RemoteStorage): Promise<void>;
}

import type { IStorage } from '@inrupt/solid-client-authn-browser';

const PREFIX = 'remotestorage:solid:auth:';

/**
 * Storage for the Solid SDK's non-secret login state. Delegate every key
 * unchanged rather than merging undocumented SDK session records together.
 * Tokens and DPoP keys remain in the SDK's separate, in-memory secure store.
 * @internal
 */
export class SolidStorage implements IStorage {
  constructor (private storage: Storage) {}

  async get (key: string): Promise<string | undefined> {
    return this.storage.getItem(PREFIX + key) ?? undefined;
  }

  async set (key: string, value: string): Promise<void> {
    this.storage.setItem(PREFIX + key, value);
  }

  async delete (key: string): Promise<void> {
    this.storage.removeItem(PREFIX + key);
  }
}

export default SolidStorage;

import {
  IStorage,
} from "@inrupt/solid-client-authn-browser";
import { ConfigObserver } from "./interfaces/configObserver";

/**
 * @class BrowserStorage
 * 
 * Mirror of BrowserStorage that is defined (but not exported) in the Inrupt
 * library.
 */
class BrowserStorage implements IStorage {
  get storage(): typeof window.localStorage {
    return window.localStorage;
  }

  async get(key: string): Promise<string | undefined> {
    return this.storage.getItem(key) || undefined;
  }

  async set(key: string, value: string): Promise<void> {
    this.storage.setItem(key, value);
  }

  async delete(key: string): Promise<void> {
    this.storage.removeItem(key);
  }
}

/**
 * @class ConfigStorage
 * 
 * An implementation for the Inrupt's IStorage that bypasses storing of the
 * session information to the ConfigObserver i.e. Solid backend.
 */
export default class ConfigStorage implements IStorage {
  private browserStorage: BrowserStorage = new BrowserStorage();
  private config: string;
  private observer: ConfigObserver;

  constructor(observer: ConfigObserver) {
    this.observer = observer;
  }

  /**
   * Information specific to the user session are stored using this prefix.
   * Caution: This is a bit hacky. Inrupt stores different sorts of data and
   * does not differentiate between them and the session specific one. Saving
   * all that as the backend config is expensive and invalid. This key
   * constant is taken from Inrupt's private code here:
   * https://github.com/inrupt/solid-client-authn-js/blob/a34357598cc218be116e38f66a983e391dc1d6b2/packages/core/src/storage/StorageUtility.ts#L150
   */
  private isConfigKey(key: string): boolean {
    return key.startsWith('solidClientAuthenticationUser');
  }

  public setConfig(config: string): void {
    this.config = config;
  }

  async get(key: string): Promise<string | undefined> {
    if (this.isConfigKey(key)) {
      return this.config;
    }
    else {
      this.browserStorage.get(key);
    }
  }

  async set(key: string, value: string): Promise<void> {
    if (this.isConfigKey(key)) {
      if (this.config) {
        const oldConfig = JSON.parse(this.config);
        const additionalConfig = JSON.parse(value);
        const newConfig = { ...oldConfig, ...additionalConfig };
        this.config = JSON.stringify(newConfig);
      }
      else {
        this.config = value;
      }
      this.observer.onConfigChanged(this.config);
    }
    else {
      this.browserStorage.set(key, value);
    }
  }

  async delete(key: string): Promise<void> {
    if (this.isConfigKey(key)) {
      this.config = undefined;
      this.observer.onConfigChanged(this.config);
    }
    else {
      this.browserStorage.delete(key);
    }
  }
}
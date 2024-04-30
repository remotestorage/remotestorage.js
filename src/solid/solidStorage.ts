import {
    IStorage,
  } from "@inrupt/solid-client-authn-browser";
import ConfigObserver from "./configObserver";

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

export default class ConfigStorage implements IStorage {
  private browserStorage: BrowserStorage = new BrowserStorage();
  private config: string;
  private observer: ConfigObserver;

  constructor(observer: ConfigObserver) {
      this.observer = observer;
  }

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
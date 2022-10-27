import {getGlobalContext} from "../../src/util";

class MemoryStorage {
  protected map: Map<string, string>;

  constructor() {
    this.map = new Map();
  }

  get length() {
    return this.map.size;
  }

  key(index: number): string | null {
    const a = Array.from(this.map.keys());
    if (index < a.length) {
      return a[index];
    } else {
      return null;
    }
  }

  getItem(key: string): string | null {
    if (this.map.has(key)) {
      return this.map.get(key);
    } else {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

}

let localStorage, sessionStorage;
const context = getGlobalContext();

if (context.localStorage) {
  localStorage = context.localStorage;
} else {
  context.localStorage = localStorage = new MemoryStorage();
}

if (context.sessionStorage) {
  sessionStorage = context.sessionStorage;
} else {
  context.sessessionStorage = sessionStorage = new MemoryStorage();
}

export {localStorage, sessionStorage};

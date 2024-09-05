import { getGlobalContext } from "../../build/util.js";

export class MemoryStorage {
  constructor() {
    this.map = new Map();
  }

  get length() {
    return this.map.size;
  }

  key(index) {
    const a = Array.from(this.map.keys());
    if (index < a.length) {
      return a[index];
    } else {
      return null;
    }
  }

  getItem(key) {
    if (this.map.has(key)) {
      return this.map.get(key);
    } else {
      return null;
    }
  }

  setItem(key, value) {
    this.map.set(key, value);
  }

  removeItem(key) {
    this.map.delete(key);
  }

  clear() {
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

export { localStorage, sessionStorage };

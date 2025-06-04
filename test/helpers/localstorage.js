class LocalStorage {
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

if (typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}

define([], function() {
  return new LocalStorage();
});

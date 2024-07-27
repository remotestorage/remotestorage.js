class MockLocation {
  constructor(url) {
    this.href = url;
    this._origin = null;
    this._pathname = null;
    this._search = null;
    this._hash = null;
  }

  toString() {
    return this.href;
  }

  get href () {
    const parts = [this._origin, this._pathname];
    if (this._search) {
      parts.push('?' + this._search);
    }
    if (this._hash) {
      parts.push('#' + this._hash);
    }
    return parts.join('');
  }

  set href (url) {
    const parts = /^(https?:\/\/[A-Za-z0-9.]+)(\/([^?#]*)?)(\?([^#]*))?(#(.*))?/.exec(url);
    if (!parts) {
      throw new Error("Invalid URL");
    }
    this._origin = parts[1] || '';
    this._pathname = parts[2] || '';
    this._search = parts[5] || '';
    this._hash = parts[7] || '';
  }

  set '' (url) {
    this.href = url;
  }

  get origin () {
    return this._origin;
  }

  set origin (origin) {
    const match = /^https?:\/\/[A-Za-z0-9.]+/.exec(origin);
    this._origin = match?.[0] || '';
  }

  get pathname () {
    return this._pathname;
  }

  set pathname (pathname) {
    const match = /^\/([^?#]*)/.exec(pathname);
    this._pathname = match?.[1] || '';
  }

  get search () {
    if (this._search) {
      return '?' + this._search;
    } else {
      return '';
    }
  }

  set search (search) {
    const match = /\?([^#]*)/.exec(search);
    this._search = match?.[1] || '';
  }

  get hash () {
    if (this._hash) {
      return '#' + this._hash;
    } else {
      return '';
    }
  }

  set hash (hash) {
    const match = /#(.*)/.exec(hash);
    this._hash = match?.[1] || '';
  }
}

export default function locationFactory(url) {
  if (!('document' in globalThis)) {
    globalThis["document"] = {};
  }
  globalThis.document.location = new MockLocation(url);
}

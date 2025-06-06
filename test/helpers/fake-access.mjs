class FakeAccess {
  constructor() {
    this._data = {};
  }

  set (moduleName, value) {
    this._data[moduleName] = value;
  }

  get (moduleName) {
    return this._data[moduleName];
  }

  checkPathPermission (path, mode) {
    if (path.substring(0, '/foo/'.length) === '/foo/') {
      return true;
    }
    if (path.substring(0, '/read/access/'.length) === '/read/access/' && mode === 'r') {
      return true;
    }
    if (path.substring(0, '/write/access/'.length) === '/write/access/') {
      return true;
    }
    if (path.substring(0, '/readings/'.length) === '/readings/' && mode === 'r') {
      return true;
    }
    if (path.substring(0, '/public/readings/'.length) === '/public/readings/' && mode === 'r') {
      return true;
    }
    if (path.substring(0, '/writings/'.length) === '/writings/') {
      return true;
    }
    if (path.substring(0, '/public/writings/'.length) === '/public/writings/') {
      return true;
    }
    return false;
  }
}

export default FakeAccess;

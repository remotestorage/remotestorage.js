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

  checkPathPermission(path, mode) {
    const permissions = new Map([
      ['/foo/', 'rw'],
      ['/read/access/', 'r'],
      ['/write/access/', 'rw'],
      ['/readings/', 'r'],
      ['/public/readings/', 'r'],
      ['/writings/', 'rw'],
      ['/public/writings/', 'rw']
    ]);

    for (const [prefix, presetMode] of permissions) {
      if (path.startsWith(prefix) && (!mode || presetMode.startsWith(mode))) {
        return true;
      }
    }
    return false;
  }
}

export default FakeAccess;

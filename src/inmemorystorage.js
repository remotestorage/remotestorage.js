
function makeNode(path) {
  var node = { path: path };
  if(path[path.length - 1] == '/') {
    node.body = {};
    node.cached = {};
    node.contentType = 'application/json';
  }
  return node;
}

RemoteStorage.InMemoryStorage = function(rs){
  this.rs = rs
  RemoteStorage.eventHandling(this, 'change', 'conflict')
  this._storage = {};
}

RemoteStorage.InMemoryStorage.prototype = {
  get: function(path){
    var node = this._storage[path];
    if(node)
      return promising().fulfill(200, node.body, node.contentType, node.revision);
    else
      return promising().fulfill(404);
  },
  put: function(path, body, contetType, incomming){
    var oldNode = this._storage[path];
    var node = {
      path: path,
      contentType: contentType,
      body: body
    }
    this._storage = node;
    this._emit('change', {
      path: path,
      origin: incoming ? 'remote' : 'window',
      oldValue: oldNode ? oldNode.body : undefined,
      newValue: body
    })
    return promising().fulfill(200);
  },
  delete: function(path, incoming){
    var oldNode = this._storage[path];
    delete this._storage[path];
    if(oldNode) {
      this._emit('change', {
        path: path,
        origin: incoming ? 'remote' : 'window',
        oldValue: oldNode.body,
        newValue: undefined
      })
    }
    return promising().fulfill(200);
  },
  setRevision: function(path, revision){
    var node = this._storage[path] || makeNode(path)
    node.revision = revision;
    this._storage[path] = node;
    return promising().fulfill();
  }
  getRevision: function(path){
    var rev;
    if(this._storage[path])
      rev = this._storage[path].revision;
    return promising().fulfill(rev);
  }
}

RemoteStorage.InMemoryStorage._rs_init = function(){}

RemoteStorage.InMemoryStorage._rs_supported = function(){
  return true;
}

RemoteStorage.InMemoryStorage._rs_cleanup = function(){}

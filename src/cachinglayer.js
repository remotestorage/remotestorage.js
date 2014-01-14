(function() {
  /**
   * Class: cachinglayer
   *
   * local storages should implement this.getNodes, this.setNodes, and this.forAllDocuments
   * the rest is blended in here to create a GPD (get/put/delete) interface
   * which the baseclient can talk to.
   * the objects itself should only expose getNodes, setNodes, and forAllNodes.
   */

  var  _isFolder = function(path) {
      return path.substr(-1) === '/';
    },
    
    _isDocument = function(path) {
      return path.substr(-1) !== '/';
    },
    
    _deepClone = function(obj) {
      return JSON.parse(JSON.stringify(obj));
    },
    
    _equal = function(obj1, obj2) {
      return JSON.stringify(obj1) === JSON.stringify(obj2);
    },
    
    _getLatest = function(node) {
      if (typeof(node) !== 'object' || typeof(node.path) != 'string') {
        return;
      }
      if (_isFolder(node.path)) {
        if (node.local && node.local.itemsMap) {
          return node.local;
        }
        if (node.official && node.official.itemsMap) {
          return node.official;
        }
      } else {
        if (node.local && node.local.body && node.local.contentType) {
          return node.local;
        }
        if (node.official && node.official.body && node.official.contentType) {
          return node.official;
        }
      }
    },

    _nodesFromRoot = function(path) {
      var parts, ret = [path];
      if(path.substr(-1) === '/') {
        //remove trailing slash if present,
        //so it's not counted as a path level
        path = path.substring(0, path.length-1);
      }
      parts = path.split('/');
      while(parts.length > 1) {
        parts.pop();
        ret.push(parts.join('/')+'/');
      }
      return ret;
    },
    _makeNode = function(path, now) {
      var ret = {
        path: path,
        official: {
          timestamp: now
        }
      };
      if(_isFolder(path)) {
        ret.official.itemsMap = {};
      }
      return ret;
    };
    
  var methods = {
    //GPD interface:
    get: function(path) {
      var promise = promising();
      this.getNodes([path]).then(function(objs) {
        var latest = _getLatest(objs[path]);
        if (latest) {
            promise.fulfill(200, latest.body, latest.contentType);
        } else {
          promise.fulfill(404);
        }       
      }.bind(this), function(err) {
        promise.reject(err);
      }.bind(this));
      return promise;
    },
    _updateNodes: function(nodePaths, cb) {
       return this.getNodes(nodePaths).then(function(objs) {
        var copyObjs = _deepClone(objs);
        objs = cb(objs);
        for (i in objs) {
          if (_equal(objs[i], copyObjs[i])) {
            delete objs[i];
          } else if(_isDocument(i)) {
            this._emit('change', {
              path: i,
              origin: 'window',
              oldValue: objs[i].local.previousBody,
              newValue: objs[i].local.body
            });
            delete objs[i].local.previousBody;
          }
        }
        return this.setNodes(objs).then(function() {
          return 200;
        });
      }.bind(this),
      function(err) {
        throw(err);
      });
    },
    put: function(path, body, contentType) {
      var i, now = new Date().getTime(), pathNodes = _nodesFromRoot(path), previous;
      return this._updateNodes(pathNodes, function(objs) {
        for (i=0; i<pathNodes.length; i++) {
          if (!objs[pathNodes[i]]) {
            objs[pathNodes[i]] = _makeNode(pathNodes[i], now);
          }
          if (i === 0) {
            //save the document itself
            previous = _getLatest(objs[pathNodes[i]]);
            objs[pathNodes[i]].local = {
              previousBody: (previous ? previous.body : undefined),
              body: body,
              contentType: contentType,
              timestamp: now
            };
          } else {
            //add it to all parents
            itemName = pathNodes[i-1].substring(pathNodes[i].length);
            if (!objs[pathNodes[i]].local) {
              objs[pathNodes[i]].local = _deepClone(objs[pathNodes[i]].official);
            }
            objs[pathNodes[i]].local.itemsMap[itemName] = true;
          }
        }
        return objs;
      });
    },
    delete: function(path) {
      var pathNodes = _nodesFromRoot(path);
      return this._updateNodes(pathNodes, function(objs) {
        var i, now = new Date().getTime();
        for (i=0; i<pathNodes.length; i++) {
          if (!objs[pathNodes[i]]) {
            throw new Exception('cannot delete a non-existing node; retrieve its parent folder first');
          }
          if(i === 0) {
            //delete the document itself
            objs[path].local = {
              timestamp: now
            };
          } else {
            //remove it from all parents
            itemName = pathNodes[i-1].substring(pathNodes[i].length);
            if (!objs[pathNodes[i]].local) {
              objs[pathNodes[i]].local = _deepClone(objs[pathNodes[i]].official);
            }
            delete objs[pathNodes[i]].local.itemsMap[itemName];
          }
        }
        return objs;
      });
    },
    fireInitial: function() {
      this.forAllNodes(function(node) {
        var latest;
        if (_isDocument(node.path)) {
          latest = _getLatest(node);
          if (latest) {
            this._emit('change', {
              path: node.path,
              origin: 'local',
              oldValue: undefined,
              oldContentType: undefined,
              newValue: latest.body,
              newContentType: latest.contentType
            });
          }
        }
      }.bind(this));
    },
    _getInternals: function() {
      return {
        _isFolder: _isFolder,
        _isDocument: _isDocument,
        _deepClone: _deepClone,
        _equal: _equal,
        _getLatest: _getLatest,
        _nodesFromRoot: _nodesFromRoot,
        _makeNode: _makeNode
      };
    }
  };

  /**
   * Function: cachingLayer
   *
   * Mixes common caching layer functionality into an object.
   *
   * The first parameter is always the object to be extended.
   *
   * Example:
   *   (start code)
   *   var MyConstructor = function() {
   *     cachingLayer(this);
   *   };
   *   (end code)
   */
  RemoteStorage.cachingLayer = function(object) {
    for (var key in methods) {
      object[key] = methods[key];
    }
  };
})();

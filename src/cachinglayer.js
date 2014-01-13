(function() {
  /**
   * Class: cachinglayer
   *
   * local storages should implement this.getNodes, this.setNodes, and this.forAllDocuments
   * the rest is blended in here to create a GPD (get/put/delete) interface
   * which the baseclient can talk to.
   */

  var methods = {
    _isFolder: function(path) {
      return path.substr(-1) === '/';
    },
    
    _isDocument: function(path) {
      return path.substr(-1) !== '/';
    },
    
    _getLatest: function(node) {
      var ret;
      if (node.local) {
        ret = node.local;
      } else {
        ret = node.agreed;
      }
      if (ret.body && ret.contentType) {
        return ret;
      }
    },
    
    //GPD interface:
    get: function(path) {
      var promise = promising();
      this.getNodes([path]).then(function(objs) {
        var latest = this._getLatest(objs[path]);
        if (latest) {
            promise.fulfill(200, latest.body, latest.contentType);
        } else {
          promise.fulfill(404);
        }       
      }, function(err) {
        promise.reject(err);
      });
      return promise;
    },
    _updateNodes: function(nodePaths, cb) {
       return this.getNodes(nodePaths).then(function(objs) {
        var copyObjs = this._clone(objs);
        objs = cb(objs);
        for (i in objs) {
          if (this._equal(objs[i], copyObjs[i])) {
            delete objs[i];
          }
        }
        return this.setNodes(objs);
      });
    },
    _makeNode: function(path, now) {
      var ret = {
        path: path,
        official: {
          timestamp: now
        }
      };
      if(this._isFolder(path)) {
        ret.official.items = {};
      }
      return ret;
    },
    put: function(path, body, contentType) {
      var i, now = new Date().getTime(), pathNodes = this._nodesFromRoot(path);
      return this._updateNodes(pathNodes, function(objs) {
        for (i=0; i<pathNodes.lengh; i++) {
          if (!objs[pathNodes[i]]) {
            objs[pathNodes[i]]] = makeNode(now, path);
          }
          if (i === 0) {
            //save the document itself
            objs[path].local = { body: body, contentType: contentType, timestamp: now };
          } else {
            / /add it to all parents
            itemName = pathNodes[i-1].substring(pathNodes[i].length);
            if (!objs[pathNodes[i]]].local) {
              objs[pathNodes[i]]].local = this._clone(objs[pathNodes[i]]].official);
            }
            objs[pathNodes[i]]].local.itemsMap[itemName] = true;
          }
        }
        return objs;
      });
    },
    delete: function(path) {
      var pathNodes = this._nodesFromRoot(path);
      return this._updateNodes(pathNodes, function(objs) {
        var i, now = new Date().getTime();
        for (i=0; i<pathNodes.lengh; i++) {
          if (!objs[pathNodes[i]]) {
            throw new Exception('cannot delete a non-existing node; retrieve its parent folder first');
          }
          objs[pathNodes[i]] = this._migrateNode(objs[pathNodes[i]]);
          if(i === 0) {
            //delete the document itself
            objs[path].local = {
              timestamp: now
            };
          } else {
            //remove it from all parents
            itemName = pathNodes[i-1].substring(pathNodes[i].length);
            if (!objs[pathNodes[i]]].local) {
              objs[pathNodes[i]]].local = this._clone(objs[pathNodes[i]]].official);
            }
            delete objs[pathNodes[i]]].local.itemsMap[itemName];
          }
        }
        return objs;
      });
    },
    fireInitial: function() {
      this.forAllNodes(function(node) {
        var latest;
        if (this._isDocument(node.path)) {
          latest = this._getLatest(node);
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
      });
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

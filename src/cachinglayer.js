(function() {
  /**
   * Class: cachinglayer
   *
   * this class defines functions that are mixed into remoteStorage.local when it is
   * instantiated. In terms of OOP, it therefore effectively acts as a base class for
   * indexeddb.js, localstorage.js, and inmemorystorage.js.
   * Thesee three remoteStorage.local implementations should implement threfore
   * implement this.getNodes, this.setNodes, and this.forAllNodes.
   * the rest is blended in here to create a GPD (get/put/delete) interface
   * which the baseclient can talk to.
   * the objects itself should only expose getNodes, setNodes, and forAllNodes.
   *
   */

  var  _isFolder = function(path) {
      return path.substr(-1) === '/';
    },

    _isDocument = function(path) {
      return path.substr(-1) !== '/';
    },

    _deepClone = function(obj) {
      if (obj === undefined) {
        return undefined;
      } else {
        return JSON.parse(JSON.stringify(obj));
      }
    },

    _equal = function(obj1, obj2) {
      return JSON.stringify(obj1) === JSON.stringify(obj2);
    },

    _getLatest = function(node) {
      if (typeof(node) !== 'object' || typeof(node.path) !== 'string') {
        return;
      }
      if (_isFolder(node.path)) {
        if (node.local && node.local.itemsMap) {
          return node.local;
        }
        if (node.common && node.common.itemsMap) {
          return node.common;
        }
      } else {
        if (node.local && node.local.body && node.local.contentType) {
          return node.local;
        }
        if (node.common && node.common.body && node.common.contentType) {
          return node.common;
        }
        //migration code; once all apps use this version of the lib, we can publish clean-up code
        //that migrates over any old-format data, and stop supporting it. for now, new apps will
        //support data in both formats, thanks to this:
        if (node.body && node.contentType) {
          return {
            body: node.body,
            contentType: node.contentType
          };
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
        common: {
          timestamp: now
        }
      };
      if(_isFolder(path)) {
        ret.common.itemsMap = {};
      }
      return ret;
    };

  var methods = {
    //GPD interface:
    get: function(path, maxAge) {
      var promise = promising();
      this.getNodes([path]).then(function(objs) {
        var latest = _getLatest(objs[path]);
        if ((typeof(maxAge) === 'number') && (
             !latest ||
             !latest.timestamp ||
             ((new Date().getTime()) - latest.timestamp > maxAge))) {
          remoteStorage.sync.queueGetRequest(path, promise);
          return promise;
        }

        if (latest) {
          promise.fulfill(200, latest.body || latest.itemsMap, latest.contentType);
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
        var i, copyObjs = _deepClone(objs);
        objs = cb(objs);
        for (i in objs) {
          if (_equal(objs[i], copyObjs[i])) {
            delete objs[i];
          } else if(_isDocument(i)) {
            this._emit('change', {
              path: i,
              origin: 'window',
              oldValue: objs[i].local.previousBody,
              newValue: objs[i].local.body,
              oldContentType: objs[i].local.previousContentType,
              newContentType: objs[i].local.contentType
            });
            delete objs[i].local.previousBody;
            delete objs[i].local.previousContentType;
          }
        }
        return this.setNodes(objs).then(function() {
          return 200;
        }).then(function(status) {
          var i;
          if (this.diffHandler) {
            for (i in objs) {
              if (i.substr(-1) !== '/') {
                this.diffHandler(i);
              }
            }
          }
          return status;
        }.bind(this));
      }.bind(this),
      function(err) {
        throw(err);
      });
    },
    put: function(path, body, contentType) {
      var i, now = new Date().getTime(), pathNodes = _nodesFromRoot(path), previous;
      return this._updateNodes(pathNodes, function(objs) {
        try {
          for (i=0; i<pathNodes.length; i++) {
            if (!objs[pathNodes[i]]) {
              objs[pathNodes[i]] = _makeNode(pathNodes[i], now);
            }
            if (i === 0) {
              //save the document itself
              previous = _getLatest(objs[pathNodes[i]]);
              objs[pathNodes[i]].local = {
                previousBody: (previous ? previous.body : undefined),
                previousContentType: (previous ? previous.contentType : undefined),
                body: body,
                contentType: contentType,
                timestamp: now
              };
            } else {
              //add it to all parents
              itemName = pathNodes[i-1].substring(pathNodes[i].length);
              if (!objs[pathNodes[i]].common) {
                objs[pathNodes[i]].common = {
                  timestamp: now,
                  itemsMap: {}
                };
              }
              if (!objs[pathNodes[i]].local) {
                objs[pathNodes[i]].local = _deepClone(objs[pathNodes[i]].common);
              }
              if (!objs[pathNodes[i]].common.itemsMap) {
                objs[pathNodes[i]].common.itemsMap = {};
              }
              if (!objs[pathNodes[i]].local.itemsMap) {
                objs[pathNodes[i]].local.itemsMap = objs[pathNodes[i]].common.itemsMap;
              }
              objs[pathNodes[i]].local.itemsMap[itemName] = true;
            }
          }
          return objs;
        } catch(e) {
          RemoteStorage.log('error while putting', objs, i, e);
          throw e;
        }
      });
    },
    delete: function(path) {
      var pathNodes = _nodesFromRoot(path);
      return this._updateNodes(pathNodes, function(objs) {
        var i, now = new Date().getTime();
        for (i=0; i<pathNodes.length; i++) {
          if (!objs[pathNodes[i]]) {
            throw new Error('cannot delete a non-existing node; retrieve its parent folder first; missing node: '+pathNodes[i]);
          }
          if(i === 0) {
            //delete the document itself
            objs[path].local = {
              body: false,
              timestamp: now
            };
          } else {
            //remove it from all parents
            itemName = pathNodes[i-1].substring(pathNodes[i].length);
            if (!objs[pathNodes[i]].local) {
              objs[pathNodes[i]].local = _deepClone(objs[pathNodes[i]].common);
            }
            delete objs[pathNodes[i]].local.itemsMap[itemName];
            if (Object.getOwnPropertyNames(objs[pathNodes[i]].local.itemsMap).length) {
              //this folder still has other items, don't remove any further ancestors
              break;
            }
          }
        }
        return objs;
      });
    },
    _getAllDescendentPaths: function(path) {
      if (_isFolder(path)) {
        return this.getNodes([path]).then(function(objs) {
          var i, pending=0, allPaths = [path], latest = _getLatest(objs[path]), promise = promising();
          for (i in latest.itemsMap) {
            pending++;
            var subPromise = this._getAllDescendentPaths(path+i);
            subPromise.then(function(paths) {
              var j;
              pending--;
              for (j=0; j<paths.length; j++) {
                allPaths.push(paths[j]);
              }
              if (pending === 0) {
                promise.fulfill(allPaths);
              }
            });
          }
          return promise;
        }.bind(this));
      } else {
        return promising().fulfill([path]);
      }
    },
    flush: function(path) {
      return this._getAllDescendentPaths(path).then(function(paths) {
        return this.getNodes(paths);
      }.bind(this)).then(function(objs) {
        var i;
        for (i in objs) {
          if (objs[i] && objs[i].common && objs[i].local) {
            this._emit('change', {
              path: objs[i].path,
              origin: 'local',
              oldValue: (objs[i].local.body === false ? undefined : objs[i].local.body),
              newValue: (objs[i].common.body === false ? undefined : objs[i].common.body)
            });
          }
          objs[i] = undefined;
        }
        return this.setNodes(objs);
      }.bind(this));
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
    onDiff: function(setOnDiff) {
      this.diffHandler = setOnDiff;
    },
    migrate: function(node) {
      if (typeof(node) === 'object' && !node.common) {
        node.common = {};
        if (typeof(node.path) === 'string') {
          if (node.path.substr(-1) === '/' && typeof(node.body) === 'object') {
            node.common.itemsMap = node.body;
          }
        } else {
          //save legacy content of document node as local version
          if (!node.local) {
            node.local = {};
          }
          node.local.body = node.body;
          node.local.contentType = node.contentType;
        }
      }
      return node;
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

(function() {
  /**
   * Interface: cachinglayer
   *
   * This module defines functions that are mixed into remoteStorage.local when
   * it is instantiated (currently one of indexeddb.js, localstorage.js, or
   * inmemorystorage.js).
   *
   * All remoteStorage.local implementations should therefore implement
   * this.getNodes, this.setNodes, and this.forAllNodes. The rest is blended in
   * here to create a GPD (get/put/delete) interface which the BaseClient can
   * talk to.
   */

  function isFolder(path) {
    return path.substr(-1) === '/';
  }

  function isDocument(path) {
    return path.substr(-1) !== '/';
  }

  function deepClone(obj) {
    if (obj === undefined) {
      return undefined;
    } else {
      return JSON.parse(JSON.stringify(obj));
    }
  }

  function equal(obj1, obj2) {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
  }

  function getLatest(node) {
    if (typeof(node) !== 'object' || typeof(node.path) !== 'string') {
      return;
    }
    if (isFolder(node.path)) {
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
      // Migration code! Once all apps use at least this version of the lib, we
      // can publish clean-up code that migrates over any old-format data, and
      // stop supporting it. For now, new apps will support data in both
      // formats, thanks to this:
      if (node.body && node.contentType) {
        return {
          body: node.body,
          contentType: node.contentType
        };
      }
    }
  }

  function isOutdated(node, maxAge) {
    return !node || !node.timestamp ||
           ((new Date().getTime()) - node.timestamp > maxAge);
  }

  function nodesFromRoot(path) {
    var paths = [path];
    var parts = path.replace(/\/$/, '').split('/');

    while (parts.length > 1) {
      parts.pop();
      paths.push(parts.join('/')+'/');
    }
    return paths;
  }

  function makeNode(path, now) {
    var node = { path: path, common: { timestamp: now } };

    if (isFolder(path)) {
      node.common.itemsMap = {};
    }
    return node;
  }

  var methods = {

    get: function(path, maxAge) {
      var promise = promising();

      this.getNodes([path]).then(function(objs) {
        var node = getLatest(objs[path]);
        if ((typeof(maxAge) === 'number') && isOutdated(node, maxAge)) {
          remoteStorage.sync.queueGetRequest(path, promise);
        }

        if (node) {
          promise.fulfill(200, node.body || node.itemsMap, node.contentType);
        } else {
          promise.fulfill(404);
        }
      }.bind(this), function(err) {
        promise.reject(err);
      }.bind(this));

      return promise;
    },

    put: function(path, body, contentType) {
      var i, now = new Date().getTime(), pathNodes = nodesFromRoot(path), previous;
      return this._updateNodes(pathNodes, function(objs) {
        try {
          for (i=0; i<pathNodes.length; i++) {
            if (!objs[pathNodes[i]]) {
              objs[pathNodes[i]] = makeNode(pathNodes[i], now);
            }
            if (i === 0) {
              //save the document itself
              previous = getLatest(objs[pathNodes[i]]);
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
                objs[pathNodes[i]].local = deepClone(objs[pathNodes[i]].common);
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
      var pathNodes = nodesFromRoot(path);
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
              objs[pathNodes[i]].local = deepClone(objs[pathNodes[i]].common);
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
        if (isDocument(node.path)) {
          latest = getLatest(node);
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

    _updateNodes: function(nodePaths, cb) {
      return this.getNodes(nodePaths).then(function(objs) {
        var i, copyObjs = deepClone(objs);
        objs = cb(objs);
        for (i in objs) {
          if (equal(objs[i], copyObjs[i])) {
            delete objs[i];
          } else if(isDocument(i)) {
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

    _getAllDescendentPaths: function(path) {
      if (isFolder(path)) {
        return this.getNodes([path]).then(function(objs) {
          var i, pending=0, allPaths = [path], latest = getLatest(objs[path]), promise = promising();
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

    _getInternals: function() {
      return {
        isFolder: isFolder,
        isDocument: isDocument,
        deepClone: deepClone,
        equal: equal,
        getLatest: getLatest,
        nodesFromRoot: nodesFromRoot,
        makeNode: makeNode
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

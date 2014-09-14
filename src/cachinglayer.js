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

  var isFolder = RemoteStorage.util.isFolder;
  var isDocument = RemoteStorage.util.isDocument;
  var deepClone = RemoteStorage.util.deepClone;
  var equal = RemoteStorage.util.equal;

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

  function isOutdated(nodes, maxAge) {
    var path, node;
    for (path in nodes) {
      if (nodes[path] && nodes[path].remote) {
        return true;
      }
      nodeVersion = getLatest(nodes[path]);
      if (nodeVersion && nodeVersion.timestamp && (new Date().getTime()) - nodeVersion.timestamp <= maxAge) {
        return false;
      } else if (!nodeVersion) {
        return true;
      }
    }
    return true;
  }

  var pathsFromRoot = RemoteStorage.util.pathsFromRoot;

  function makeNode(path) {
    var node = { path: path, common: { } };

    if (isFolder(path)) {
      node.common.itemsMap = {};
    }
    return node;
  }

  function updateFolderNodeWithItemName(node, itemName) {
    if (!node.common) {
      node.common = {
        itemsMap: {}
      };
    }
    if (!node.common.itemsMap) {
      node.common.itemsMap = {};
    }
    if (!node.local) {
      node.local = deepClone(node.common);
    }
    if (!node.local.itemsMap) {
      node.local.itemsMap = node.common.itemsMap;
    }
    node.local.itemsMap[itemName] = true;

    return node;
  }

  var methods = {

    // TODO: improve our code structure so that this function
    // could call sync.queueGetRequest directly instead of needing
    // this hacky third parameter as a callback
    get: function(path, maxAge, queueGetRequest) {
      var promise = promising();

      if (typeof(maxAge) === 'number') {
        this.getNodes(pathsFromRoot(path)).then(function(objs) {
          var node = getLatest(objs[path]);
          if (isOutdated(objs, maxAge)) {
            queueGetRequest(path, promise);
          } else if (node) {
            promise.fulfill(200, node.body || node.itemsMap, node.contentType);
          } else {
            promise.fulfill(404);
          }
        }.bind(this), function(err) {
          promise.reject(err);
        });
      } else {
        this.getNodes([path]).then(function(objs) {
          var node = getLatest(objs[path]);
          if (node) {
            if (isFolder(path)) {
              for (var i in node.itemsMap) {
                // the hasOwnProperty check here is only because our jshint settings require it:
                if (node.itemsMap.hasOwnProperty(i) && node.itemsMap[i] === false) {
                  delete node.itemsMap[i];
                }
              }
            }
            promise.fulfill(200, node.body || node.itemsMap, node.contentType);
          } else {
            promise.fulfill(404);
          }
        }.bind(this), function(err) {
          promise.reject(err);
        });
      }
      return promise;
    },

    put: function(path, body, contentType) {
      var paths = pathsFromRoot(path);

      return this._updateNodes(paths, function(nodes) {
        try {
          for (var i=0; i<paths.length; i++) {
            var path = paths[i];
            var node = nodes[path];
            var previous;

            if (!node) {
              nodes[path] = node = makeNode(path);
            }

            // Document
            if (i === 0) {
              previous = getLatest(node);
              node.local = {
                body:                body,
                contentType:         contentType,
                previousBody:        (previous ? previous.body : undefined),
                previousContentType: (previous ? previous.contentType : undefined),
              };
            }
            // Folder
            else {
              var itemName = paths[i-1].substring(path.length);
              node = updateFolderNodeWithItemName(node, itemName);
            }
          }
          return nodes;
        } catch(e) {
          RemoteStorage.log('[Cachinglayer] Error during PUT', nodes, i, e);
          throw e;
        }
      });
    },

    delete: function(path) {
      var paths = pathsFromRoot(path);

      return this._updateNodes(paths, function(nodes) {
        for (var i=0; i<paths.length; i++) {
          var path = paths[i];
          var node = nodes[path];

          if (!node) {
            throw new Error('Cannot delete non-existing node '+path);
          }

          // Document
          if (i === 0) {
            previous = getLatest(node);
            node.local = {
              body:                false,
              previousBody:        (previous ? previous.body : undefined),
              previousContentType: (previous ? previous.contentType : undefined),
            };
          }
          // Folder
          else {
            if (!node.local) {
              node.local = deepClone(node.common);
            }
            var itemName = paths[i-1].substring(path.length);
            delete node.local.itemsMap[itemName];

            if (Object.getOwnPropertyNames(node.local.itemsMap).length > 0) {
              // This folder still contains other items, don't remove any further ancestors
              break;
            }
          }
        }
        return nodes;
      });
    },

    flush: function(path) {
      return this._getAllDescendentPaths(path).then(function(paths) {
        return this.getNodes(paths);
      }.bind(this)).then(function(nodes) {
        for (var path in nodes) {
          var node = nodes[path];

          if (node && node.common && node.local) {
            this._emitChange({
              path:     node.path,
              origin:   'local',
              oldValue: (node.local.body === false ? undefined : node.local.body),
              newValue: (node.common.body === false ? undefined : node.common.body)
            });
          }
          nodes[path] = undefined;
        }
        return this.setNodes(nodes);
      }.bind(this));
    },

    _emitChange: function(obj) {
      if (RemoteStorage.config.changeEvents[obj.origin]) {
        this._emit('change', obj);
      }
    },

    fireInitial: function() {
      if (!RemoteStorage.config.changeEvents.local) {
        return;
      }
      this.forAllNodes(function(node) {
        var latest;
        if (isDocument(node.path)) {
          latest = getLatest(node);
          if (latest) {
            this._emitChange({
              path:           node.path,
              origin:         'local',
              oldValue:       undefined,
              oldContentType: undefined,
              newValue:       latest.body,
              newContentType: latest.contentType
            });
          }
        }
      }.bind(this)).then(function () {
        this._emit('local-events-done');
      }.bind(this));
    },

    onDiff: function(diffHandler) {
      this.diffHandler = diffHandler;
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

    _updateNodesRunning: false,
    _updateNodesQueued: [],
    _updateNodes: function(paths, cb) {
      var promise = promising();
      this._doUpdateNodes(paths, cb, promise);
      return promise;
    },
    _doUpdateNodes: function(paths, cb, promise) {
      var self = this;

      if (this._updateNodesRunning) {
        this._updateNodesQueued.push({
          paths: paths,
          cb: cb,
          promise: promise
        });
        return;
      } else {
        this._updateNodesRunning = true;
      }

      this.getNodes(paths).then(function(nodes) {
        var existingNodes = deepClone(nodes);
        var changeEvents = [];
        var node;

        nodes = cb(nodes);

        for (var path in nodes) {
          node = nodes[path];
          if (equal(node, existingNodes[path])) {
            delete nodes[path];
          }
          else if(isDocument(path)) {
            changeEvents.push({
              path:           path,
              origin:         'window',
              oldValue:       node.local.previousBody,
              newValue:       node.local.body === false ? undefined : node.local.body,
              oldContentType: node.local.previousContentType,
              newContentType: node.local.contentType
            });
            delete node.local.previousBody;
            delete node.local.previousContentType;
          }
        }

        self.setNodes(nodes).then(function() {
          self._emitChangeEvents(changeEvents);
          promise.fulfill(200);
        });
      }).then(undefined, promise.reject).then(function() {
        this._updateNodesRunning = false;
        var nextJob = this._updateNodesQueued.shift();
        if (nextJob) {
          this._doUpdateNodes(nextJob.paths, nextJob.cb, nextJob.promise);
        }
      }.bind(this));
    },

    _emitChangeEvents: function(events) {
      for (var i=0; i<events.length; i++) {
        this._emitChange(events[i]);
        if (this.diffHandler) {
          this.diffHandler(events[i].path);
        }
      }
    },

    _getAllDescendentPaths: function(path) {
      if (isFolder(path)) {
        return this.getNodes([path]).then(function(nodes) {
          var pending = 0;
          var allPaths = [path];
          var latest = getLatest(nodes[path]);
          var promise = promising();

          for (var itemName in latest.itemsMap) {
            pending++;
            this._getAllDescendentPaths(path+itemName).then(function(paths) {
              pending--;
              for (var i=0; i<paths.length; i++) {
                allPaths.push(paths[i]);
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
        getLatest: getLatest,
        makeNode: makeNode,
        isOutdated: isOutdated
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

(function () {
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
      var nodeVersion = getLatest(nodes[path]);
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
    get: function (path, maxAge, queueGetRequest) {
      var self = this;
      if (typeof(maxAge) === 'number') {
        return self.getNodes(pathsFromRoot(path))
        .then(function (objs) {
          var node = getLatest(objs[path]);
          if (isOutdated(objs, maxAge)) {
            return queueGetRequest(path);
          } else if (node) {
            return {statusCode: 200, body: node.body || node.itemsMap, contentType: node.contentType};
          } else {
            return {statusCode: 404};
          }
        });
      } else {
        return self.getNodes([path])
        .then(function (objs) {
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
            return {statusCode: 200, body: node.body || node.itemsMap, contentType: node.contentType};
          } else {
            return {statusCode: 404};
          }
        });
      }
    },

    put: function (path, body, contentType) {
      var paths = pathsFromRoot(path);
      var self = this;

      function _processNodes(paths, nodes) {
        try {
          for (var i = 0, len = paths.length; i < len; i++) {
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
        } catch (e) {
          RemoteStorage.log('[Cachinglayer] Error during PUT', nodes, i, e);
          throw e;
        }
      }
      return this._updateNodes(paths, _processNodes);
    },

    delete: function (path) {
      var paths = pathsFromRoot(path);

      return this._updateNodes(paths, function (paths, nodes) {
        for (var i = 0, len = paths.length; i < len; i++) {
          var path = paths[i];
          var node = nodes[path];
          if (!node) {
            throw new Error('Cannot delete non-existing node '+path);
          }

          if (i === 0) {
          // Document
            previous = getLatest(node);
            node.local = {
              body:                false,
              previousBody:        (previous ? previous.body : undefined),
              previousContentType: (previous ? previous.contentType : undefined),
            };
          } else {
          // Folder
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

    flush: function (path) {
      var self = this;
      return self._getAllDescendentPaths(path).then(function (paths) {
        return self.getNodes(paths);
      }).then(function (nodes) {
        for (var path in nodes) {
          var node = nodes[path];

          if (node && node.common && node.local) {
            self._emitChange({
              path:     node.path,
              origin:   'local',
              oldValue: (node.local.body === false ? undefined : node.local.body),
              newValue: (node.common.body === false ? undefined : node.common.body)
            });
          }
          nodes[path] = undefined;
        }
        return self.setNodes(nodes);
      });
    },

    _emitChange: function (obj) {
      if (RemoteStorage.config.changeEvents[obj.origin]) {
        this._emit('change', obj);
      }
    },

    fireInitial: function () {
      if (!RemoteStorage.config.changeEvents.local) {
        return;
      }
      var self = this;
      self.forAllNodes(function (node) {
        var latest;
        if (isDocument(node.path)) {
          latest = getLatest(node);
          if (latest) {
            self._emitChange({
              path:           node.path,
              origin:         'local',
              oldValue:       undefined,
              oldContentType: undefined,
              newValue:       latest.body,
              newContentType: latest.contentType
            });
          }
        }
      }).then(function () {
        self._emit('local-events-done');
      });
    },

    onDiff: function (diffHandler) {
      this.diffHandler = diffHandler;
    },

    migrate: function (node) {
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

    // FIXME
    // this process of updating nodes needs to be heavily documented first, then
    // refactored. Right now it's almost impossible to refactor as there's no
    // explanation of why things are implemented certain ways or what the goal(s)
    // of the behavior are. -slvrbckt
    _updateNodesRunning: false,
    _updateNodesQueued: [],
    _updateNodes: function (paths, _processNodes) {
      var pending = Promise.defer();
      this._doUpdateNodes(paths, _processNodes, pending);
      return pending.promise;
    },
    _doUpdateNodes: function (paths, _processNodes, promise) {
      var self = this;

      if (self._updateNodesRunning) {
        self._updateNodesQueued.push({
          paths: paths,
          cb: _processNodes,
          promise: promise
        });
        return;
      } else {
        self._updateNodesRunning = true;
      }

      self.getNodes(paths).then(function (nodes) {
        var existingNodes = deepClone(nodes);
        var changeEvents = [];
        var node;
        nodes = _processNodes(paths, nodes);

        for (var path in nodes) {
          node = nodes[path];
          if (equal(node, existingNodes[path])) {
            delete nodes[path];
          }
          else if (isDocument(path)) {
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

        self.setNodes(nodes).then(function () {
          self._emitChangeEvents(changeEvents);
          promise.resolve({statusCode: 200});
        });
      }).then(function () {
        return Promise.resolve();
      }, function (err) {
        promise.reject(err);
      }).then(function () {
        self._updateNodesRunning = false;
        var nextJob = self._updateNodesQueued.shift();
        if (nextJob) {
          self._doUpdateNodes(nextJob.paths, nextJob.cb, nextJob.promise);
        }
      });
    },

    _emitChangeEvents: function (events) {
      for (var i = 0, len = events.length; i < len; i++) {
        this._emitChange(events[i]);
        if (this.diffHandler) {
          this.diffHandler(events[i].path);
        }
      }
    },

    _getAllDescendentPaths: function (path) {
      var self = this;
      if (isFolder(path)) {
        return self.getNodes([path]).then(function (nodes) {
          var allPaths = [path];
          var latest = getLatest(nodes[path]);

          var itemNames = Object.keys(latest.itemsMap);
          var calls = itemNames.map(function (itemName) {
            return self._getAllDescendentPaths(path+itemName).then(function (paths) {
              for (var i = 0, len = paths.length; i < len; i++) {
                allPaths.push(paths[i]);
              }
            });
          });
          return Promise.all(calls).then(function () {
            return allPaths;
          });
        });
      } else {
        return Promise.resolve([path]);
      }
    },

    _getInternals: function () {
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
   *   var MyConstructor = function () {
   *     cachingLayer(this);
   *   };
   *   (end code)
   */
  RemoteStorage.cachingLayer = function (object) {
    for (var key in methods) {
      object[key] = methods[key];
    }
  };
})();

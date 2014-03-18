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

  function pathsFromRoot(path) {
    var paths = [path];
    var parts = path.replace(/\/$/, '').split('/');

    while (parts.length > 1) {
      parts.pop();
      paths.push(parts.join('/')+'/');
    }
    return paths;
  }

  function makeNode(path, timestamp) {
    var node = { path: path, common: { timestamp: timestamp } };

    if (isFolder(path)) {
      node.common.itemsMap = {};
    }
    return node;
  }

  function updateFolderNodeWithItemName(node, itemName, timestamp) {
    if (!node.common) {
      node.common = {
        timestamp: timestamp,
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
      var paths = pathsFromRoot(path);
      var now = new Date().getTime();

      return this._updateNodes(paths, function(nodes) {
        try {
          for (var i=0; i<paths.length; i++) {
            var path = paths[i];
            var node = nodes[path];
            var previous;

            if (!node) {
              nodes[path] = node = makeNode(path, now);
            }

            // Document
            if (i === 0) {
              previous = getLatest(node);
              node.local = {
                body:                body,
                contentType:         contentType,
                timestamp:           now,
                previousBody:        (previous ? previous.body : undefined),
                previousContentType: (previous ? previous.contentType : undefined),
              };
            }
            // Folder
            else {
              var itemName = paths[i-1].substring(path.length);
              node = updateFolderNodeWithItemName(node, itemName, now);
            }
          }
          return nodes;
        } catch(e) {
          RemoteStorage.log('Error during PUT', nodes, i, e);
          throw e;
        }
      });
    },

    delete: function(path) {
      var paths = pathsFromRoot(path);

      return this._updateNodes(paths, function(nodes) {
        var now = new Date().getTime();

        for (var i=0; i<paths.length; i++) {
          var path = paths[i];
          var node = nodes[path];

          if (!node) {
            throw new Error('Cannot delete non-existing node '+path);
          }

          // Document
          if (i === 0) {
            // TODO should body better be undefined?
            node.local = { body: false, timestamp: now };
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
            this._emit('change', {
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

    fireInitial: function() {
      this.forAllNodes(function(node) {
        var latest;
        if (isDocument(node.path)) {
          latest = getLatest(node);
          if (latest) {
            this._emit('change', {
              path:           node.path,
              origin:         'local',
              oldValue:       undefined,
              oldContentType: undefined,
              newValue:       latest.body,
              newContentType: latest.contentType
            });
          }
        }
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

    _updateNodes: function(paths, cb) {
      var self = this;

      return this.getNodes(paths).then(function(nodes) {
        var existingNodes = deepClone(nodes);
        var changeEvents = [];

        nodes = cb(nodes);

        for (var path in nodes) {
          if (equal(nodes[path], existingNodes[path])) {
            delete nodes[path];
          }
          else if(isDocument(path)) {
            changeEvents.push({
              path:           path,
              origin:         'window',
              oldValue:       nodes[path].local.previousBody,
              newValue:       nodes[path].local.body,
              oldContentType: nodes[path].local.previousContentType,
              newContentType: nodes[path].local.contentType
            });
            delete nodes[path].local.previousBody;
            delete nodes[path].local.previousContentType;
          }
        }

        return self.setNodes(nodes).then(function() {
          self._emitChangeEvents(changeEvents);
          return 200;
        });
      },
      function(err) {
        throw(err);
      });
    },

    _emitChangeEvents: function(events) {
      for (var i=0; i<events.length; i++) {
        this._emit('change', events[i]);
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
        isFolder: isFolder,
        isDocument: isDocument,
        deepClone: deepClone,
        equal: equal,
        getLatest: getLatest,
        pathsFromRoot: pathsFromRoot,
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
